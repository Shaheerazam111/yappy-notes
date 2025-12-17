"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Download, Loader2, XCircle, CheckCircle } from "lucide-react";
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

interface MessageBubbleProps {
  message: {
    _id: string;
    senderUserId: string;
    text?: string | null;
    imageBase64?: string | null;
    createdAt: string | Date;
    seenAt?: string | Date;
  };
  currentUserId: string;
  senderName: string;
  onDelete?: (messageId: string) => void;
  isNoteMode?: boolean; // When true, show as centered note
  showSeenDelivered?: boolean; // Show seen indicators
  isDeleting?: boolean; // Show loading state while deleting
}

export function MessageBubble({
  message,
  currentUserId,
  senderName,
  onDelete,
  isNoteMode = false,
  showSeenDelivered = false,
  isDeleting = false,
}: MessageBubbleProps) {
  const isCurrentUser = message.senderUserId === currentUserId;
  const alignment = isNoteMode
    ? "items-center"
    : isCurrentUser
    ? "items-end"
    : "items-start";
  const bubbleColor = isNoteMode
    ? "bg-muted text-muted-foreground"
    : isCurrentUser
    ? "bg-muted text-muted-foreground"
    : "bg-muted text-muted-foreground";
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  return (
    <div
      className={`flex flex-col mb-4 group w-full ${
        isNoteMode
          ? "items-center"
          : isCurrentUser
          ? "items-end"
          : "items-start"
      }`}
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
            <div className="mb-2 rounded overflow-hidden relative group/image">
              <img
                src={message.imageBase64}
                alt="Shared image"
                className="max-w-full h-auto rounded"
                style={{ maxHeight: "400px" }}
              />
              <div className="absolute top-2 right-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-background/90 hover:bg-background shadow-md"
                      onClick={handleDownloadImage}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download image</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
          {message.text && (
            <p className="wrap-break-word whitespace-pre-wrap">{message.text}</p>
          )}
        </div>
        {isCurrentUser && onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
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
          <span className="text-xs text-muted-foreground">{senderName}</span>
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
              {message.seenAt ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
    </div>
  );
}
