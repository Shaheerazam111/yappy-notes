"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Download,
  Loader2,
  XCircle,
  CheckCircle,
  Eye,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Reaction {
  userId: string;
  emoji: string;
}

interface MessageBubbleProps {
  message: {
    _id: string;
    senderUserId: string;
    text?: string | null;
    imageBase64?: string | null;
    createdAt: string | Date;
    seenAt?: string | Date;
    reactions?: Reaction[];
    isDeleted?: boolean; // Flag to indicate if message is deleted (for Bubu)
    deletedFor?: string[]; // Array of user IDs who deleted this message
  };
  currentUserId: string;
  currentUserName: string;
  senderName: string;
  onDelete?: (messageId: string) => void;
  isNoteMode?: boolean; // When true, show as centered note
  showSeenDelivered?: boolean; // Show seen indicators
  isDeleting?: boolean; // Show loading state while deleting
  isLastMessage?: boolean; // If this is the last message in the list
  onTripleClick?: () => void; // Handler for triple-click to toggle chat mode
  onReaction?: (messageId: string, emoji: string) => Promise<void>; // Handler for reaction
}

export function MessageBubble({
  message,
  currentUserId,
  currentUserName,
  senderName,
  onDelete,
  isNoteMode = false,
  showSeenDelivered = false,
  isDeleting = false,
  isLastMessage = false,
  onTripleClick,
  onReaction,
}: MessageBubbleProps) {
  const isCurrentUser = message.senderUserId === currentUserId;
  const alignment = isNoteMode
    ? "items-center"
    : isCurrentUser
    ? "items-end"
    : "items-start";

  // For Bubu: Show deleted messages with red background
  const isDeleted = message.isDeleted || false;
  const bubbleColor =
    isDeleted && currentUserName === "Bubu"
      ? "bg-destructive/20 text-destructive-foreground border border-destructive/50"
      : isNoteMode
      ? "bg-muted text-muted-foreground"
      : isCurrentUser
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-muted-foreground";
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showReactionDialog, setShowReactionDialog] = useState(false);
  const [clickTimes, setClickTimes] = useState<number[]>([]);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Common emoji reactions
  const reactionEmojis = ["❤️", "😂", "😮", "😢", "🙏", "👍", "👎", "🔥"];

  // Group reactions by emoji and count
  const groupedReactions: Record<
    string,
    { emoji: string; count: number; userReacted: boolean }
  > =
    message.reactions?.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          userReacted: false,
        };
      }
      acc[reaction.emoji].count++;
      if (reaction.userId === currentUserId) {
        acc[reaction.emoji].userReacted = true;
      }
      return acc;
    }, {} as Record<string, { emoji: string; count: number; userReacted: boolean }>) ||
    {};

  const formatTime = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(message._id);
      setShowDeleteDialog(false);
    }
  };

  const handleDownloadImage = () => {
    if (message.imageBase64) {
      // Create a link element and trigger download
      const link = document.createElement("a");
      link.href = message.imageBase64;
      link.download = `image-${message._id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't handle click if long press was just triggered
    if (isLongPressing) {
      e.stopPropagation();
      return;
    }

    if (!isLastMessage || !onTripleClick) return;

    const now = Date.now();
    const newClickTimes = [...clickTimes, now].filter(
      (time) => now - time < 500
    ); // Keep clicks within 500ms window

    setClickTimes(newClickTimes);

    if (newClickTimes.length >= 3) {
      // Triple-click detected
      onTripleClick();
      setClickTimes([]); // Reset after triggering
    }
  };

  // Long press detection for reactions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left mouse button
    // Don't trigger long press on buttons or interactive elements
    if ((e.target as HTMLElement).closest("button")) return;

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowReactionDialog(true);
    }, 500); // 500ms for long press
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Small delay to prevent click from firing after long press
    setTimeout(() => setIsLongPressing(false), 100);
  };

  const handleMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't trigger long press on buttons or interactive elements
    if ((e.target as HTMLElement).closest("button")) return;

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      setShowReactionDialog(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Small delay to prevent click from firing after long press
    setTimeout(() => setIsLongPressing(false), 100);
  };

  const handleReactionClick = async (emoji: string) => {
    if (onReaction) {
      await onReaction(message._id, emoji);
      setShowReactionDialog(false);
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
    <div
      ref={messageRef}
      className={`flex flex-col mb-4 group w-full ${
        isNoteMode
          ? "items-center"
          : isCurrentUser
          ? "items-end"
          : "items-start"
      }`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`flex items-start ${
          isNoteMode
            ? "justify-center w-full"
            : isCurrentUser
            ? "justify-end"
            : "justify-start"
        } gap-2 w-full`}
      >
        <div
          className={`${
            isNoteMode
              ? "max-w-[90%] md:max-w-[70%]"
              : "max-w-[80%] md:max-w-[60%]"
          } rounded-lg px-4 py-2 ${bubbleColor} relative`}
        >
          {message.imageBase64 && (
            <div className="mb-2 rounded overflow-hidden relative group/image flex items-center justify-center min-h-[100px] bg-muted/50">
              <Button
                variant="ghost"
                size="lg"
                className="flex flex-col items-center justify-center gap-2 h-auto p-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImageModal(true);
                }}
              >
                <Eye className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  View Image
                </span>
              </Button>
            </div>
          )}
          {message.text && (
            <p className="wrap-break-word whitespace-pre-wrap">
              {message.text}
            </p>
          )}
          {/* Display reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.values(groupedReactions).map((reaction, index) => (
                <Button
                  key={index}
                  variant={reaction.userReacted ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReactionClick(reaction.emoji);
                  }}
                >
                  <span>{reaction.emoji}</span>
                  <span className="ml-1">{reaction.count}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        {isCurrentUser &&
          onDelete &&
          (currentUserName === "Bubu" || currentUserName === "Dudu") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete message</p>
              </TooltipContent>
            </Tooltip>
          )}
      </div>
      <div
        className={`flex items-center gap-2 mt-1 ${
          isNoteMode
            ? "justify-center w-full"
            : isCurrentUser
            ? "justify-end ml-auto"
            : "justify-start"
        } ${!isNoteMode && !isCurrentUser ? "max-w-[80%] md:max-w-[60%]" : ""}`}
      >
        {!isNoteMode && (
          <span className="text-xs text-muted-foreground">
            {senderName.charAt(0).toUpperCase()}
          </span>
        )}
        {!isNoteMode && (
          <span className="text-xs text-muted-foreground">•</span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
        {showSeenDelivered && isCurrentUser && (
          <>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {/* show proper seen and delivered icons */}
              {message.seenAt ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
            </span>
          </>
        )}
      </div>

      {/* Delete Message Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>View Image</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {message.imageBase64 && (
              <img
                src={message.imageBase64}
                alt="Shared image"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            )}
            <div className="absolute top-4 left-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 bg-background/90 hover:bg-background shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage();
                    }}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download image</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reaction Picker Dialog */}
      <Dialog open={showReactionDialog} onOpenChange={setShowReactionDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add Reaction</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2 py-4">
            {reactionEmojis.map((emoji) => {
              const reaction = groupedReactions[emoji];
              const userReacted = reaction?.userReacted || false;
              return (
                <Button
                  key={emoji}
                  variant={userReacted ? "default" : "outline"}
                  size="lg"
                  className="text-2xl h-12"
                  onClick={() => handleReactionClick(emoji)}
                >
                  {emoji}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
