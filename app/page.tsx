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
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing user on mount
  useEffect(() => {
    const checkExistingUser = async () => {
      try {
        // First, check if user exists in localStorage (for returning visitors)
        const storedUserId = localStorage.getItem('chatUserId');
        const storedUserName = localStorage.getItem('chatUserName');

        if (storedUserId && storedUserName) {
          // Verify user exists in DB
          const response = await fetch('/api/users');
          if (response.ok) {
            const users = await response.json();
            setAllUsers(users);
            const userExists = users.some((u: { _id: string }) => u._id === storedUserId);
            
            if (userExists) {
              // Returning user - skip passcode modal, go directly to notes
              setCurrentUserId(storedUserId);
              setCurrentUserName(storedUserName);
              setPasscodeVerified(true);
              setLoading(false);
              return;
            }
          }
        }

        // No session user, check if this is first time (no users in DB)
        const response = await fetch('/api/users');
        if (response.ok) {
          const users = await response.json();
          setAllUsers(users);
          
          if (users.length === 0) {
            // First time ever - show passcode modal first
            setShowPasscodeModal(true);
            setLoading(false);
          } else {
            // Users exist but no session - show username modal (will find existing or create)
            setShowUsernameModal(true);
            setPasscodeVerified(true); // Skip passcode for returning to app
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking users:', error);
        setLoading(false);
      }
    };

    checkExistingUser();
  }, []);

  const handlePasscodeCorrect = () => {
    setPasscodeVerified(true);
    setShowPasscodeModal(false);
    // After passcode, show username modal if needed
    if (!currentUserId) {
      setShowUsernameModal(true);
    }
  };

  const handleUsernameSet = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    setCurrentUserName(userName);
    setShowUsernameModal(false);
    // Store in localStorage for persistent storage across sessions
    localStorage.setItem('chatUserId', userId);
    localStorage.setItem('chatUserName', userName);
    // Refresh users list
    fetch('/api/users')
      .then((res) => res.json())
      .then((users) => setAllUsers(users))
      .catch((err) => console.error('Error fetching users:', err));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show passcode modal only on first login (when no users exist)
  if (showPasscodeModal) {
    return <PasscodeModal open={true} onPasscodeCorrect={handlePasscodeCorrect} />;
  }

  // Show username modal if needed
  if (showUsernameModal || (!currentUserId && passcodeVerified)) {
    return (
      <>
        <UsernameModal
          open={showUsernameModal}
          onUsernameSet={handleUsernameSet}
        />
        {!showUsernameModal && (
          <div className="flex items-center justify-center h-[100dvh]">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        )}
      </>
    );
  }

  // If no user ID and passcode not verified, show nothing (shouldn't happen)
  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
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
