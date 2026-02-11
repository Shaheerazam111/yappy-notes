"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Sun,
  Moon,
  Square,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

interface PasscodeModalProps {
  open: boolean;
  onPasscodeCorrect: () => void;
  allUsers?: Array<{ _id: string; name: string }>;
}

export function PasscodeModal({
  open,
  onPasscodeCorrect,
  allUsers = [],
}: PasscodeModalProps) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [storedPasscode, setStoredPasscode] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [hasUserSession, setHasUserSession] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const storedUserId =
        typeof window !== "undefined"
          ? localStorage.getItem("chatUserId")
          : null;
      const response = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, userId: storedUserId || undefined }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.destroy) {
          toast.success("View cleared");
          setPasscode("");
          // Do not call onPasscodeCorrect - user stays on passcode screen; when they log in later they will see no messages
        } else {
          onPasscodeCorrect();
          setPasscode("");
          if (storedUserId) {
            fetch("/api/push/notify-opened", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: storedUserId }),
            }).catch(() => {});
          }
        }
      } else {
        setError(data.error || "Incorrect passcode");
      }
    } catch (error) {
      setError("Failed to verify passcode");
    } finally {
      setLoading(false);
    }
  };

  const handleLongPressStart = () => {
    isLongPressingRef.current = false;
    longPressTimerRef.current = setTimeout(async () => {
      isLongPressingRef.current = true;
      try {
        const response = await fetch("/api/auth/passcode");
        if (response.ok) {
          const data = await response.json();
          setStoredPasscode(data.passcode || "");
          setShowPasscodeModal(true);
        } else {
          toast.error("Failed to fetch passcode");
        }
      } catch (error) {
        toast.error("Failed to fetch passcode");
      }
    }, 3000); // 3 seconds
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressingRef.current = false;
  };

  const handleCopyPasscode = async () => {
    try {
      await navigator.clipboard.writeText(storedPasscode);
      setCopied(true);
      toast.success("Passcode copied to clipboard");
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      toast.error("Failed to copy passcode");
    }
  };

  const getMessageText = (type: "morning" | "night" | "busy" | "buzz") => {
    const currentUserId = localStorage.getItem("chatUserId");
    const currentUserName = localStorage.getItem("chatUserName");

    if (!currentUserId || !currentUserName) {
      return "";
    }

    const otherUser = allUsers.find((u) => u._id !== currentUserId);
    const otherUserName = otherUser?.name ?? "there";

    switch (type) {
      case "morning":
        return `Assalam-u-alaikum good morning ${otherUserName} m uth kr fresh hona ja rhi miss u`;
      case "night":
        return `${otherUserName} aj sb h sth is lia m app open kr k msg nhi kr rhi snap bhi nhi ki na whatsapp ap preshan nhi hona m thk ho yad you or so jna m bhi so jao gi`;
      case "busy":
        return `${otherUserName} abhi thora busy ho but yad ho dheer sara jldi kro gi bat time dekh k`;
      case "buzz":
        return `bhooot saraa pyar yaad you khana pina acha s m bhi kh rhi ho khayal rkho m bhi rkh rhi ho or heart p hand yhi h hm ek dosra k pass`;
      default:
        return "";
    }
  };

  const handleSendQuickMessage = async (
    type: "morning" | "night" | "busy" | "buzz"
  ) => {
    const currentUserId = localStorage.getItem("chatUserId");
    const currentUserName = localStorage.getItem("chatUserName");

    if (!currentUserId || !currentUserName) {
      toast.error("User not found. Please login first.");
      return;
    }

    const messageText = getMessageText(type);
    if (!messageText) {
      toast.error("Failed to generate message");
      return;
    }

    setSendingMessage(true);

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
        toast.success("Done");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    // Check if user session exists
    const checkUserSession = () => {
      const userId = localStorage.getItem("chatUserId");
      const userName = localStorage.getItem("chatUserName");
      setHasUserSession(!!(userId && userName));
    };

    checkUserSession();

    // Listen for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = () => {
      checkUserSession();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px] select-none">
        <DialogHeader>
          <DialogTitle
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            className="cursor-pointer"
          >
            Enter Passcode
          </DialogTitle>
          <DialogDescription>
            Please enter the passcode to access the notes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError("");
              }}
              autoFocus
              disabled={loading || sendingMessage}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading || sendingMessage}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || sendingMessage}
          >
            {loading ? "Verifying..." : "Enter"}
          </Button>

          {/* Quick Message Buttons - Only show if user session exists */}
          {hasUserSession && (
            <div className="flex gap-2 justify-center pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleSendQuickMessage("morning")}
                disabled={loading || sendingMessage}
                className="shrink-0"
                title="Good Morning"
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleSendQuickMessage("night")}
                disabled={loading || sendingMessage}
                className="shrink-0"
                title="Good Night"
              >
                <Moon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleSendQuickMessage("busy")}
                disabled={loading || sendingMessage}
                className="shrink-0"
                title="Busy"
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleSendQuickMessage("buzz")}
                disabled={loading || sendingMessage}
                className="shrink-0"
                title="Reminder"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          )}
        </form>
      </DialogContent>

      {/* Passcode Display Modal */}
      <Dialog open={showPasscodeModal} onOpenChange={setShowPasscodeModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Passcode</DialogTitle>
            <DialogDescription>
              Long press on "Enter Passcode" heading for 3 seconds to view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input
                type="text"
                value={storedPasscode}
                readOnly
                className="pr-10 font-mono text-lg"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={handleCopyPasscode}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowPasscodeModal(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
