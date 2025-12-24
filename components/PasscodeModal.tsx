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
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PasscodeModalProps {
  open: boolean;
  onPasscodeCorrect: () => void;
}

export function PasscodeModal({ open, onPasscodeCorrect }: PasscodeModalProps) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [storedPasscode, setStoredPasscode] = useState("");
  const [copied, setCopied] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onPasscodeCorrect();
        setPasscode("");
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

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            className="cursor-pointer select-none"
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
              disabled={loading}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Enter"}
          </Button>
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
