'use client';

import { useState, useEffect } from 'react';
import { PasscodeModal } from '@/components/PasscodeModal';
import { UsernameModal } from '@/components/UsernameModal';
import { ChatWindow } from '@/components/ChatWindow';

export default function Home() {
  const [passcodeVerified, setPasscodeVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [allUsers, setAllUsers] = useState<Array<{ _id: string; name: string }>>([]);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Always require passcode on page load
  useEffect(() => {
    setPasscodeVerified(false);
    setCurrentUserId(null);
    setLoading(false);
  }, []);

  const handlePasscodeCorrect = () => {
    setPasscodeVerified(true);
    checkUserExists();
  };

  const checkUserExists = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);

        // Check if there's a user stored in sessionStorage (temporary, per session)
        const storedUserId = sessionStorage.getItem('chatUserId');
        const storedUserName = sessionStorage.getItem('chatUserName');

        if (storedUserId && storedUserName) {
          // Verify user still exists in DB
          const userExists = users.some((u: { _id: string }) => u._id === storedUserId);
          if (userExists) {
            setCurrentUserId(storedUserId);
            setCurrentUserName(storedUserName);
            return;
          }
        }

        // If no stored user or user doesn't exist, show username modal
        if (users.length === 0) {
          setShowUsernameModal(true);
        } else {
          // If users exist but no stored user, show username modal to create/select
          setShowUsernameModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking users:', error);
    }
  };

  const handleUsernameSet = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    setCurrentUserName(userName);
    setShowUsernameModal(false);
    // Store in sessionStorage for this session only
    sessionStorage.setItem('chatUserId', userId);
    sessionStorage.setItem('chatUserName', userName);
    // Refresh users list
    checkUserExists();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!passcodeVerified) {
    return <PasscodeModal open={true} onPasscodeCorrect={handlePasscodeCorrect} />;
  }

  if (showUsernameModal || !currentUserId) {
    return (
      <>
        <UsernameModal
          open={showUsernameModal}
          onUsernameSet={handleUsernameSet}
        />
        {!showUsernameModal && (
          <div className="flex items-center justify-center h-screen">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        )}
      </>
    );
  }

  return (
    <ChatWindow
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      allUsers={allUsers}
    />
  );
}
