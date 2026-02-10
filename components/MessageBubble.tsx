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
  Reply,
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
    audioBase64?: string | null;
    audioMimeType?: string | null;
    createdAt: string | Date;
    seenAt?: string | Date;
    reactions?: Reaction[];
    isDeleted?: boolean; // Flag to indicate if message is deleted (admin sees these)
    deletedFor?: string[]; // Array of user IDs who deleted this message
    status?: "sending" | "sent" | "failed";
    replyToMessageId?: string;
    replyToText?: string | null;
    replyToSenderUserId?: string;
  };
  currentUserId: string;
  currentUserName: string;
  senderName: string;
  replyToSenderName?: string; // Display name for the message being replied to
  onDelete?: (messageId: string) => void;
  onReply?: (message: MessageBubbleProps["message"]) => void;
  isNoteMode?: boolean; // When true, show as centered note
  showSeenDelivered?: boolean; // Show seen indicators
  isDeleting?: boolean; // Show loading state while deleting
  isLastMessage?: boolean; // If this is the last message in the list
  onTripleClick?: () => void; // Handler for triple-click to toggle chat mode
  onReaction?: (messageId: string, emoji: string) => Promise<void>; // Handler for reaction
  showDateHeader?: boolean; // Show date header if this is first message of the day
  previousMessageDate?: string | Date | null; // Previous message date for comparison
  isAdmin?: boolean; // Current user is admin (can delete messages, see deleted state)
  showSenderInitial?: boolean; // Show sender initial only on last message of a consecutive group from same sender
}

export function MessageBubble({
  message,
  currentUserId,
  currentUserName,
  senderName,
  replyToSenderName,
  onDelete,
  onReply,
  isNoteMode = false,
  showSeenDelivered = false,
  isDeleting = false,
  isLastMessage = false,
  onTripleClick,
  onReaction,
  showDateHeader = false,
  previousMessageDate,
  isAdmin = false,
  showSenderInitial = false,
}: MessageBubbleProps) {
  const isCurrentUser = message.senderUserId === currentUserId;
  const alignment = isNoteMode
    ? "items-center"
    : isCurrentUser
    ? "items-end"
    : "items-start";

  const isDeleted = message.isDeleted || false;
  const bubbleColor =
    isDeleted && isAdmin
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  const LONG_PRESS_MS = 800; // Longer delay so scrolling doesn't trigger reaction modal
  const MOVE_THRESHOLD_PX = 12; // Cancel long-press if finger/mouse moves this much (scroll)

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
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDate = new Date(d);
    messageDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
    }
  };

  const isSameDate = (
    date1: string | Date,
    date2: string | Date | null | undefined
  ) => {
    if (!date2) return false;
    const d1 = typeof date1 === "string" ? new Date(date1) : date1;
    const d2 = typeof date2 === "string" ? new Date(date2) : date2;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const [isHovered, setIsHovered] = useState(false);

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

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

  // Long press detection for reactions (longer delay + cancel on scroll/move)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    touchStartRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      touchStartRef.current = null;
      setIsLongPressing(true);
      setShowReactionDialog(true);
    }, LONG_PRESS_MS);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
      cancelLongPress();
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    setTimeout(() => setIsLongPressing(false), 100);
  };

  const handleMouseLeave = () => {
    cancelLongPress();
    setIsLongPressing(false);
  };

  // Touch events for mobile - cancel long-press if user scrolls (moves finger)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;

    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      touchStartRef.current = null;
      setIsLongPressing(true);
      setShowReactionDialog(true);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
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
    <>
      {/* Date Header */}
      {showDateHeader && (
        <div className="flex justify-center my-4">
          <span className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full">
            {formatDate(message.createdAt)}
          </span>
        </div>
      )}

      <div
        ref={messageRef}
        className={`flex flex-col mb-2 group w-full ${
          isNoteMode
            ? "items-center"
            : isCurrentUser
            ? "items-end"
            : "items-start"
        }`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
          handleMouseLeave();
          setIsHovered(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
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
          {/* For current user: action buttons on the left (order-1) so bubble (order-2) doesn't shift when they appear */}
          {isCurrentUser && onReply && (
            <div
              className={`flex items-center gap-0 shrink-0 w-6 h-6 transition-opacity ${
                isHovered || isLongPressing
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
              style={{ order: 1 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(message);
                    }}
                  >
                    <Reply className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reply</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          {isCurrentUser && onDelete && isAdmin && (
            <div
              className={`flex items-center shrink-0 w-6 h-6 transition-opacity ${
                isHovered || isLongPressing
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
              style={{ order: 1 }}
            >
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
            </div>
          )}
          <div
            className={`${
              isNoteMode
                ? "max-w-[90%] md:max-w-[70%]"
                : "max-w-[80%] md:max-w-[60%]"
            } min-w-0 overflow-hidden rounded-lg px-4 py-2 ${bubbleColor} relative group/message ${
              isCurrentUser ? "order-2" : ""
            }`}
          >
            {/* Reply strip - show quoted message above body */}
            {(message.replyToMessageId || message.replyToText) && (
              <div className="flex items-start gap-2 mb-2 pl-2 border-l-2 border-muted-foreground/40 text-muted-foreground">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium">
                    {replyToSenderName ?? "Unknown"}
                  </span>
                  <p className="text-xs truncate mt-0.5">
                    {message.replyToText || "Photo"}
                  </p>
                </div>
              </div>
            )}
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
            {message.audioBase64 && (
              <div className="mb-2">
                <audio
                  controls
                  className="w-full max-w-[280px] h-9"
                  src={`data:${message.audioMimeType || "audio/webm"};base64,${
                    message.audioBase64
                  }`}
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
            <div className="flex items-end justify-between gap-2 min-w-0">
              <div className="flex-1 min-w-0 overflow-hidden">
                {message.text && (
                  <p className="wrap-anywhere whitespace-pre-wrap">
                    {message.text}
                  </p>
                )}
                {/* Display reactions - always visible when message has reactions */}
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
              {/* Time inline at bottom right of message */}
              <div className="flex items-center gap-1 shrink-0 self-end">
                {message.status === "sending" && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" />
                )}
                <span className="text-[10px] text-muted-foreground/70 leading-none whitespace-nowrap">
                  {message.status === "sending"
                    ? "Sending..."
                    : formatTime(message.createdAt)}
                </span>
                {showSeenDelivered &&
                  isCurrentUser &&
                  message.status !== "sending" && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {message.seenAt ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                    </span>
                  )}
              </div>
            </div>
          </div>
          {/* Reply button - for other users, show on right on hover */}
          {!isCurrentUser && onReply && (isHovered || isLongPressing) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(message);
                  }}
                >
                  <Reply className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reply</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {/* Sender initial - only on last message of consecutive group from same sender */}
        {!isNoteMode && !isCurrentUser && showSenderInitial && (
          <div className="flex items-center gap-1 mt-1 max-w-[80%] md:max-w-[60%]">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted/50 text-[10px] font-medium text-muted-foreground border border-border/50">
              {senderName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

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
    </>
  );
}
