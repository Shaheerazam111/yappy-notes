"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UsernameModalProps {
  open: boolean;
  onUsernameSet: (userId: string, userName: string) => void;
}

export function UsernameModal({ open, onUsernameSet }: UsernameModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    // Restrict to only Bubu and Dudu
    const trimmedName = name.trim();
    const allowedNames = ["Dudu", "Bubu"];
    const matchedName = allowedNames.find(
      (allowedName) => allowedName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (!matchedName) {
      setError("Invalid");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: matchedName }),
      });

      const data = await response.json();

      if (response.ok) {
        onUsernameSet(data._id, data.name);
        setName("");
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (error) {
      setError("Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>Enter your name to get started.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            autoFocus
            disabled={loading}
            maxLength={50}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
