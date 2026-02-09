"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { compressImageToBase64 } from "@/lib/compressImage";
import {
  RefreshCw,
  Image as ImageIcon,
  Trash2,
  X,
  Smile,
  Loader2,
  LogOut,
  RotateCw,
  Menu,
  Settings,
  Reply,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { UpdatePasscodeDialog } from "./UpdatePasscodeDialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Reaction {
  userId: string;
  emoji: string;
}

interface Message {
  _id: string;
  senderUserId: string;
  text?: string | null;
  imageBase64?: string | null;
  createdAt: string | Date;
  reactions?: Reaction[];
  status?: "sending" | "sent" | "failed";
  replyToMessageId?: string;
  replyToText?: string | null;
  replyToSenderUserId?: string;
}

interface ChatWindowProps {
  currentUserId: string;
  currentUserName: string;
  allUsers: Array<{ _id: string; name: string; isAdmin?: boolean }>;
  onRefreshUsers?: () => Promise<void>;
}

export function ChatWindow({
  currentUserId,
  currentUserName,
  allUsers,
  onRefreshUsers,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [clearingChat, setClearingChat] = useState(false);
  const [resettingApp, setResettingApp] = useState(false);
  const [updatingPasscode, setUpdatingPasscode] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [showMenuOpen, setShowMenuOpen] = useState(false);
  const [showSettingsOpen, setShowSettingsOpen] = useState(false);
  const [skipSessionRecheck, setSkipSessionRecheck] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("chatSkipSessionRecheck") === "true"
      : false
  );
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState(false); // Hidden chat mode, unlocked by passcode
  const [syncEnabled, setSyncEnabled] = useState(false); // Auto-sync toggle
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledToBottomOnLoadRef = useRef(false);

  const getUserName = (userId: string) => {
    const user = allUsers.find((u) => u._id === userId);
    return user?.name || "Unknown";
  };

  const isAdmin =
    allUsers.find((u) => u._id === currentUserId)?.isAdmin === true;

  const fetchMessages = async (beforeId?: string, append = false) => {
    if (beforeId) {
      setLoadingOlder(true);
    } else {
      setRefreshing(true);
    }

    try {
      const url = beforeId
        ? `/api/messages?limit=50&before=${beforeId}&userId=${currentUserId}`
        : `/api/messages?limit=50&userId=${currentUserId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (append && data.messages) {
          // Prepend older messages
          setMessages((prev) => [...data.messages, ...prev]);
        } else if (data.messages) {
          // Replace with new messages
          setMessages(data.messages);
        } else {
          // Fallback for old API format
          setMessages(data);
        }
        setHasMore(data.hasMore !== false);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setRefreshing(false);
      setLoadingOlder(false);
      setInitialLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (oldestMessage) {
      const container = messagesContainerRef.current;
      const previousScrollHeight = container?.scrollHeight ?? 0;
      const previousScrollTop = container?.scrollTop ?? 0;

      await fetchMessages(oldestMessage._id, true);

      // Restore scroll position after React has rendered the prepended messages
      const restoreScroll = () => {
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          const scrollDifference = newScrollHeight - previousScrollHeight;
          messagesContainerRef.current.scrollTop =
            previousScrollTop + scrollDifference;
        }
      };
      setTimeout(restoreScroll, 0);
      requestAnimationFrame(() => setTimeout(restoreScroll, 0));
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    // Only auto-scroll if we're near the bottom (within 100px)
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  // Auto-scroll to bottom only on first load (not when loading older messages at top)
  useEffect(() => {
    if (
      !initialLoading &&
      messages.length > 0 &&
      !hasScrolledToBottomOnLoadRef.current
    ) {
      hasScrolledToBottomOnLoadRef.current = true;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    }
  }, [initialLoading, messages.length]);

  // Infinite scroll - load older messages when scrolling to top
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Load more when within 200px of top
      if (
        container.scrollTop < 200 &&
        hasMore &&
        !loadingOlder &&
        messages.length > 0
      ) {
        loadOlderMessages();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingOlder, messages.length]);

  // Merge server messages with optimistic (sending) messages and sort by date
  const displayMessages = (() => {
    const fromServer = chatMode
      ? messages
      : messages.filter((msg) => msg.senderUserId === currentUserId);
    const merged = [...fromServer, ...optimisticMessages];
    merged.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return merged;
  })();

  const handleSendMessage = async () => {
    if (!text.trim() && !loading) return;

    const messageText = text.trim();

    // Intercept passcode in message input
    if (!chatMode) {
      try {
        const response = await fetch("/api/auth/passcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: messageText }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          // Correct passcode - unlock chat mode and mark messages as seen
          setChatMode(true);
          setText("");

          // Mark all other user's messages as seen
          await fetch("/api/messages/seen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUserId }),
          });

          await fetchMessages(); // Refresh to show all messages
          return;
        }
        // Wrong passcode - continue as normal note (no error shown)
      } catch (error) {
        // Network error - continue as normal note
      }
    }

    const replyToMessageId = replyingToMessage?._id ?? undefined;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      senderUserId: currentUserId,
      text: messageText,
      createdAt: new Date(),
      status: "sending",
      ...(replyToMessageId &&
        replyingToMessage && {
          replyToMessageId,
          replyToText:
            replyingToMessage.text?.slice(0, 100) ??
            (replyingToMessage.imageBase64 ? "Photo" : null),
          replyToSenderUserId: replyingToMessage.senderUserId,
        }),
    };
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);
    setText("");
    setReplyingToMessage(null);
    setLoading(true);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: currentUserId,
          text: messageText,
          ...(replyToMessageId && { replyToMessageId }),
        }),
      });

      const data = await response.json();

      if (response.ok && data._id) {
        // Replace optimistic with real message from server
        setMessages((prev) => [...prev, { ...data, status: "sent" }]);
        setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setLoading(true);

    try {
      const imageBase64 = await compressImageToBase64(file);

      const replyToMessageId = replyingToMessage?._id ?? undefined;
      const tempId = `temp-img-${Date.now()}`;
      const optimisticMessage: Message = {
        _id: tempId,
        senderUserId: currentUserId,
        imageBase64,
        createdAt: new Date(),
        status: "sending",
        ...(replyToMessageId &&
          replyingToMessage && {
            replyToMessageId,
            replyToText:
              replyingToMessage.text?.slice(0, 100) ??
              (replyingToMessage.imageBase64 ? "Photo" : null),
            replyToSenderUserId: replyingToMessage.senderUserId,
          }),
      };
      setOptimisticMessages((prev) => [...prev, optimisticMessage]);
      setReplyingToMessage(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: currentUserId,
          imageBase64,
          ...(replyToMessageId && { replyToMessageId }),
        }),
      });

      const data = await response.json();

      if (response.ok && data._id) {
        setMessages((prev) => [...prev, { ...data, status: "sent" }]);
        setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        setOptimisticMessages((prev) => prev.filter((m) => m._id !== tempId));
        toast.error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setOptimisticMessages((prev) =>
        prev.filter((m) => !String(m._id).startsWith("temp-img-"))
      );
      toast.error("Failed to upload image");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleClearChat = async () => {
    setClearingChat(true);
    try {
      const response = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (response.ok) {
        await fetchMessages();
        setShowClearDialog(false);
        toast.success("Chat cleared successfully");
      } else {
        toast.error("Failed to clear chat");
      }
    } catch (error) {
      console.error("Error clearing chat:", error);
      toast.error("Failed to clear chat");
    } finally {
      setClearingChat(false);
    }
  };

  const handleResetApp = async () => {
    setResettingApp(true);
    try {
      await fetch("/api/messages", { method: "DELETE" });
      await fetch("/api/users", { method: "DELETE" });
      setShowResetDialog(false);
      toast.success("App reset successfully");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error resetting app:", error);
      toast.error("Failed to reset app");
      setResettingApp(false);
    }
  };

  const handleUpdatePasscode = async (newPasscode: string) => {
    setUpdatingPasscode(true);
    try {
      const response = await fetch("/api/auth/passcode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: newPasscode,
          userId: currentUserId,
        }),
      });

      if (response.ok) {
        setShowPasscodeDialog(false);
        toast.success("Passcode updated successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update passcode");
      }
    } catch (error) {
      console.error("Error updating passcode:", error);
      toast.error("Failed to update passcode");
    } finally {
      setUpdatingPasscode(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const prevMessage = displayMessages.find((m) => m._id === messageId);
    const prevReactions = prevMessage?.reactions || [];

    const hasReaction = prevReactions.some(
      (r) => r.userId === currentUserId && r.emoji === emoji
    );
    const nextReactions = hasReaction
      ? prevReactions.filter(
          (r) => !(r.userId === currentUserId && r.emoji === emoji)
        )
      : [...prevReactions, { userId: currentUserId, emoji }];

    const applyReactions = (reactions: Reaction[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, reactions: [...reactions] } : m
        )
      );
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, reactions: [...reactions] } : m
        )
      );
    };

    applyReactions(nextReactions);

    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          emoji,
        }),
      });

      const data = await response.json();

      if (response.ok && data.reactions) {
        applyReactions(data.reactions);
      } else {
        applyReactions(prevReactions);
        toast.error("Failed to update reaction");
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
      applyReactions(prevReactions);
      toast.error("Failed to add reaction");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAdmin) {
      toast.error("Only admin can delete messages");
      return;
    }

    setDeletingMessage(messageId);
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (response.ok) {
        await fetchMessages();
        toast.success("Message deleted successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete message");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    } finally {
      setDeletingMessage(null);
    }
  };

  const handleToggleChatMode = async () => {
    if (!chatMode) {
      // Switching from Notes to Chat mode
      setChatMode(true);

      // Mark all other user's messages as seen
      await fetch("/api/messages/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });

      await fetchMessages(); // Refresh to show all messages
    } else {
      // Switching from Chat to Notes mode
      setChatMode(false);
      await fetchMessages(); // Refresh to show only notes
    }

    // Scroll to bottom after mode toggle and messages are loaded
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("chatUserId");
    localStorage.removeItem("chatUserName");
    window.location.reload();
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showEmojiPicker]);

  // Auto-sync interval
  useEffect(() => {
    if (syncEnabled) {
      // Set up interval to fetch messages every 5 seconds
      syncIntervalRef.current = setInterval(() => {
        fetchMessages();
      }, 5000); // 5 seconds

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval when sync is disabled
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncEnabled]);

  const handleToggleSync = () => {
    setSyncEnabled(!syncEnabled);
    setShowMenuOpen(false);
    if (!syncEnabled) {
      toast.success("Auto-sync enabled");
    } else {
      toast.info("Auto-sync disabled");
    }
  };

  const handleSettingsToggleSkipRecheck = () => {
    const next = !skipSessionRecheck;
    setSkipSessionRecheck(next);
    localStorage.setItem("chatSkipSessionRecheck", next ? "true" : "false");
    toast.success(
      next
        ? "You won’t be asked for passcode when switching tabs or windows."
        : "Passcode will be required when switching tabs or windows."
    );
  };

  const openSettings = () => {
    setShowMenuOpen(false);
    setShowSettingsOpen(true);
  };

  const handleSetAdmin = async (adminUserId: string) => {
    if (!isAdmin) return;
    setAssigningAdmin(true);
    try {
      const response = await fetch("/api/users/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUserId,
          requestedByUserId: currentUserId,
        }),
      });
      if (response.ok) {
        await onRefreshUsers?.();
        toast.success("Admin updated");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to set admin");
      }
    } catch (err) {
      console.error("Error setting admin:", err);
      toast.error("Failed to set admin");
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) return;
    setDeletingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedByUserId: currentUserId }),
      });
      if (response.ok) {
        await onRefreshUsers?.();
        if (userId === currentUserId) {
          handleLogout();
          return;
        }
        toast.success("User removed");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between shrink-0 sticky top-0 z-10 bg-background">
        <h1 className="text-xl font-semibold">Notes</h1>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMenuOpen(true)}
                className="gap-2"
              >
                <Menu className="h-4 w-4" />
                Menu
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open menu</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Menu dropdown (dialog) */}
      <Dialog open={showMenuOpen} onOpenChange={setShowMenuOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
            <DialogDescription>Actions and options</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 py-2">
            <Button
              variant="ghost"
              className="justify-start gap-2 font-normal"
              onClick={handleToggleSync}
            >
              <RotateCw
                className={`h-4 w-4 shrink-0 ${
                  syncEnabled ? "animate-spin" : ""
                }`}
              />
              {syncEnabled ? "Turn off auto-sync" : "Turn on auto-sync"}
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 font-normal"
              onClick={openSettings}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </Button>
            {chatMode && (
              <>
                <Button
                  variant="ghost"
                  className="justify-start gap-2 font-normal"
                  disabled={refreshing}
                  onClick={async () => {
                    setShowMenuOpen(false);
                    await fetchMessages();
                    toast.success("Messages refreshed");
                  }}
                >
                  <RefreshCw
                    className={`h-4 w-4 shrink-0 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  Refresh messages
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-2 font-normal text-destructive hover:text-destructive"
                  onClick={() => {
                    setShowMenuOpen(false);
                    setShowClearDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  Clear all messages
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="justify-start gap-2 font-normal text-destructive hover:text-destructive"
                    onClick={() => {
                      setShowMenuOpen(false);
                      setShowResetDialog(true);
                    }}
                  >
                    <X className="h-4 w-4 shrink-0" />
                    Reset app (delete all data)
                  </Button>
                )}
              </>
            )}
            <div className="my-1 border-t border-border" />
            <Button
              variant="ghost"
              className="justify-start gap-2 font-normal"
              onClick={() => {
                setShowMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog
        open={showSettingsOpen}
        onOpenChange={(open) => {
          setShowSettingsOpen(open);
          if (!open) {
            setSkipSessionRecheck(
              localStorage.getItem("chatSkipSessionRecheck") === "true"
            );
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Passcode, admin, and session options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin && (
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-sm font-medium">Update passcode</h4>
                <p className="text-xs text-muted-foreground">
                  Change the passcode required to open the app.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setShowSettingsOpen(false);
                    setShowPasscodeDialog(true);
                  }}
                >
                  <span className="text-base">🔑</span>
                  Update passcode
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <Label
                htmlFor="skip-session-recheck"
                className="cursor-pointer flex-1 text-sm font-normal leading-snug"
              >
                Don&apos;t ask for passcode when switching tabs or windows
              </Label>
              <button
                id="skip-session-recheck"
                type="button"
                role="switch"
                aria-checked={skipSessionRecheck}
                onClick={handleSettingsToggleSkipRecheck}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  skipSessionRecheck ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow ring-0 transition-transform ${
                    skipSessionRecheck ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {isAdmin && (
              <>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="text-sm font-medium">Assign admin</h4>
                  <p className="text-xs text-muted-foreground">
                    Choose who can update passcode, clear chat, reset app, and
                    delete messages.
                  </p>
                  <div className="flex flex-col gap-1.5 pt-2">
                    {allUsers.map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">
                          {u.name}
                          {u.isAdmin && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (admin)
                            </span>
                          )}
                        </span>
                        <Button
                          variant={u.isAdmin ? "secondary" : "outline"}
                          size="sm"
                          disabled={u.isAdmin || assigningAdmin}
                          onClick={() => handleSetAdmin(u._id)}
                        >
                          {assigningAdmin ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : u.isAdmin ? (
                            "Current"
                          ) : (
                            "Set as admin"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="text-sm font-medium">Users</h4>
                  <p className="text-xs text-muted-foreground">
                    Remove a user. If you delete the admin, another user becomes
                    admin. You cannot delete the only user.
                  </p>
                  <div className="flex flex-col gap-1.5 pt-2">
                    {allUsers.map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">{u.name}</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={
                            deletingUserId !== null || allUsers.length <= 1
                          }
                          onClick={() => handleDeleteUser(u._id)}
                        >
                          {deletingUserId === u._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages - overflow-anchor:auto keeps scroll stable; select-none prevents accidental text selection while scrolling */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 min-h-0 select-none [overflow-anchor:auto]"
      >
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading notes...</p>
            </div>
          </div>
        ) : (
          <>
            {loadingOlder && (
              <div className="flex items-center justify-center py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading older messages...
              </div>
            )}
            {displayMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No notes available
              </div>
            ) : (
              displayMessages.map((message, index) => {
                const previousMessage =
                  index > 0 ? displayMessages[index - 1] : null;
                const currentDate = new Date(message.createdAt);
                const previousDate = previousMessage
                  ? new Date(previousMessage.createdAt)
                  : null;

                // Show date header if this is the first message or date changed
                const showDateHeader =
                  !previousDate ||
                  currentDate.getFullYear() !== previousDate.getFullYear() ||
                  currentDate.getMonth() !== previousDate.getMonth() ||
                  currentDate.getDate() !== previousDate.getDate();

                return (
                  <MessageBubble
                    key={message._id}
                    message={message}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    senderName={getUserName(message.senderUserId)}
                    replyToSenderName={
                      message.replyToSenderUserId
                        ? getUserName(message.replyToSenderUserId)
                        : undefined
                    }
                    onDelete={handleDeleteMessage}
                    onReply={setReplyingToMessage}
                    isNoteMode={!chatMode}
                    showSeenDelivered={chatMode}
                    isDeleting={deletingMessage === message._id}
                    isLastMessage={index === displayMessages.length - 1}
                    onTripleClick={handleToggleChatMode}
                    onReaction={handleReaction}
                    showDateHeader={showDateHeader}
                    previousMessageDate={previousMessage?.createdAt}
                    isAdmin={isAdmin}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input - fixed min height to reduce layout shift when typing */}
      <div className="border-t border-border p-3 md:p-4 overflow-visible shrink-0 sticky bottom-0 z-10 bg-background min-h-[52px]">
        <div className="relative overflow-visible">
          {replyingToMessage && (
            <div className="flex items-center gap-2 mb-2 py-1.5 px-2 rounded-md bg-muted/80 border border-border text-sm">
              <Reply className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 min-w-0 text-muted-foreground">
                Replying to:{" "}
                {replyingToMessage.text
                  ? replyingToMessage.text.slice(0, 50)
                  : replyingToMessage.imageBase64
                  ? "Photo"
                  : ""}
                {(replyingToMessage.text?.length ?? 0) > 50 ? "…" : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setReplyingToMessage(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex gap-2 items-end min-h-10">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={loading}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload image</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={loading}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="shrink-0"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add emoji</p>
              </TooltipContent>
            </Tooltip>
            <textarea
              placeholder={chatMode ? "Type a message..." : "Add a note..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
              rows={1}
              className="flex-1 min-h-10 max-h-24 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto"
              style={{
                height: "40px",
                maxHeight: "96px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "40px";
                target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !text.trim()}
              className="shrink-0 min-w-[64px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Sending...
                </>
              ) : chatMode ? (
                "Send"
              ) : (
                "Add"
              )}
            </Button>
          </div>
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-full mb-2 left-0 z-50 shadow-lg rounded-lg overflow-hidden"
              style={{
                maxWidth: "min(350px, calc(100vw - 2rem))",
              }}
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.DARK}
                width={350}
                height={400}
              />
            </div>
          )}
        </div>
      </div>

      {/* Clear Chat Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Notes</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all messages? Images will remain
              stored in the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={clearingChat}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearChat}
              disabled={clearingChat}
            >
              {clearingChat ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Clearing...
                </>
              ) : (
                "Clear Notes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset App Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset App</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset the entire app? This will delete
              all users and messages. Images will remain stored in the database.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={resettingApp}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetApp}
              disabled={resettingApp}
            >
              {resettingApp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                "Reset App"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Passcode Dialog */}
      <UpdatePasscodeDialog
        open={showPasscodeDialog}
        onClose={() => setShowPasscodeDialog(false)}
        onUpdate={handleUpdatePasscode}
        loading={updatingPasscode}
      />
    </div>
  );
}
