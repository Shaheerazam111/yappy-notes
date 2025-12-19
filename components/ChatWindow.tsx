"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

interface ChatWindowProps {
  currentUserId: string;
  currentUserName: string;
  allUsers: Array<{ _id: string; name: string }>;
}

export function ChatWindow({
  currentUserId,
  currentUserName,
  allUsers,
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
  const [chatMode, setChatMode] = useState(false); // Hidden chat mode, unlocked by passcode
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const getUserName = (userId: string) => {
    const user = allUsers.find((u) => u._id === userId);
    return user?.name || "Unknown";
  };

  const fetchMessages = async (beforeId?: string, append = false) => {
    if (beforeId) {
      setLoadingOlder(true);
    } else {
      setRefreshing(true);
    }

    try {
      const url = beforeId
        ? `/api/messages?limit=50&before=${beforeId}`
        : "/api/messages?limit=50";
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
      const previousScrollHeight =
        messagesContainerRef.current?.scrollHeight || 0;
      await fetchMessages(oldestMessage._id, true);

      // Maintain scroll position after loading older messages
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          const scrollDifference = newScrollHeight - previousScrollHeight;
          messagesContainerRef.current.scrollTop = scrollDifference;
        }
      }, 0);
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

  // Filter messages based on mode
  const displayMessages = chatMode
    ? messages
    : messages.filter((msg) => msg.senderUserId === currentUserId);

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

    // Normal message/note sending
    setText("");
    setLoading(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: currentUserId,
          text: messageText,
        }),
      });

      if (response.ok) {
        await fetchMessages();
        // Scroll to bottom after refresh to show new message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
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

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderUserId: currentUserId,
          imageBase64,
        }),
      });

      if (response.ok) {
        await fetchMessages();
        // Scroll to bottom after refresh to show new image
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        toast.success("Image uploaded successfully");
      } else {
        toast.error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
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
          userName: currentUserName,
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
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          emoji,
        }),
      });

      if (response.ok) {
        // Refresh messages to show updated reactions
        await fetchMessages();
      } else {
        toast.error("Failed to add reaction");
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Failed to add reaction");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessage(messageId);
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchMessages();
        toast.success("Message deleted successfully");
      } else {
        toast.error("Failed to delete message");
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

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 bg-background">
        <h1 className="text-xl font-semibold">Notes</h1>
        <div className="flex gap-2 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
          {chatMode && (
            <>
              {currentUserName === "Shaheer" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasscodeDialog(true)}
                    >
                      🔑
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Update passcode</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetchMessages();
                      toast.success("Messages refreshed");
                    }}
                    disabled={refreshing}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh messages</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear chat</p>
                </TooltipContent>
              </Tooltip>
              {currentUserName === "Shaheer" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResetDialog(true)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset app</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 min-h-0"
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
              displayMessages.map((message, index) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  currentUserId={currentUserId}
                  senderName={getUserName(message.senderUserId)}
                  onDelete={handleDeleteMessage}
                  isNoteMode={!chatMode}
                  showSeenDelivered={chatMode}
                  isDeleting={deletingMessage === message._id}
                  isLastMessage={index === displayMessages.length - 1}
                  onTripleClick={handleToggleChatMode}
                  onReaction={handleReaction}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 relative overflow-visible flex-shrink-0 sticky bottom-0 z-10 bg-background">
        <div className="relative overflow-visible">
          <div className="flex gap-2">
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
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add emoji</p>
              </TooltipContent>
            </Tooltip>
            <Input
              type="text"
              placeholder={chatMode ? "Type a message..." : "Add a note..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !text.trim()}
            >
              {chatMode ? "Send" : "Add"}
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
