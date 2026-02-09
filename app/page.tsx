"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PasscodeModal } from "@/components/PasscodeModal";
import { UsernameModal } from "@/components/UsernameModal";
import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  const [passcodeVerified, setPasscodeVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [allUsers, setAllUsers] = useState<
    Array<{ _id: string; name: string; isAdmin?: boolean }>
  >([]);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const wasVisibleRef = useRef(true);

  // Always require passcode on app load/reopen
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Always show passcode modal first on app load
        setShowPasscodeModal(true);

        // Load users list in background
        const response = await fetch("/api/users");
        if (response.ok) {
          const users = await response.json();
          setAllUsers(users);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error initializing app:", error);
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Require passcode on page visibility change (tab switch, minimize) - unless user disabled in Settings
  useEffect(() => {
    const skipRecheck =
      localStorage.getItem("chatSkipSessionRecheck") === "true";

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (
          wasVisibleRef.current === false &&
          passcodeVerified &&
          !skipRecheck
        ) {
          setPasscodeVerified(false);
          setShowPasscodeModal(true);
        }
        wasVisibleRef.current = true;
      } else {
        wasVisibleRef.current = false;
      }
    };

    wasVisibleRef.current = document.visibilityState === "visible";
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [passcodeVerified]);

  // Require passcode on route/pathname change - unless user disabled in Settings
  useEffect(() => {
    const skipRecheck =
      localStorage.getItem("chatSkipSessionRecheck") === "true";
    if (pathname && passcodeVerified && !skipRecheck) {
      setPasscodeVerified(false);
      setShowPasscodeModal(true);
    }
  }, [pathname]);

  const handlePasscodeCorrect = async () => {
    setPasscodeVerified(true);
    setShowPasscodeModal(false);

    // After passcode verification, check for stored user
    const storedUserId = localStorage.getItem("chatUserId");
    const storedUserName = localStorage.getItem("chatUserName");

    if (storedUserId && storedUserName) {
      // Verify user exists in DB
      try {
        const response = await fetch("/api/users");
        if (response.ok) {
          const users = await response.json();
          setAllUsers(users);
          const userExists = users.some(
            (u: { _id: string }) => u._id === storedUserId
          );

          if (userExists) {
            // Use stored user
            setCurrentUserId(storedUserId);
            setCurrentUserName(storedUserName);
            return;
          }
        }
      } catch (error) {
        console.error("Error verifying user:", error);
      }
    }

    // No valid stored user, show username modal
    setShowUsernameModal(true);
  };

  const handleUsernameSet = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    setCurrentUserName(userName);
    setShowUsernameModal(false);
    // Store in localStorage for persistent storage across sessions
    localStorage.setItem("chatUserId", userId);
    localStorage.setItem("chatUserName", userName);
    // Refresh users list
    fetch("/api/users")
      .then((res) => res.json())
      .then((users) => setAllUsers(users))
      .catch((err) => console.error("Error fetching users:", err));
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
    return (
      <PasscodeModal
        open={true}
        onPasscodeCorrect={handlePasscodeCorrect}
        allUsers={allUsers}
      />
    );
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

  const refreshUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
      }
    } catch (err) {
      console.error("Error refreshing users:", err);
    }
  };

  return (
    <ChatWindow
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      allUsers={allUsers}
      onRefreshUsers={refreshUsers}
    />
  );
}
