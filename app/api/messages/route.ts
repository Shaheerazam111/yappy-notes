import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET - Fetch messages with pagination support
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");
    const userId = searchParams.get("userId");

    const db = await getDb();
    let query: any = {};

    const { ObjectId } = await import("mongodb");
    const currentUser =
      userId && ObjectId.isValid(userId)
        ? await db.collection("users").findOne({ _id: new ObjectId(userId) })
        : null;
    const isAdmin = currentUser?.isAdmin === true;

    if (userId && !isAdmin) {
      query.$or = [
        { deletedFor: { $exists: false } },
        { deletedFor: { $nin: [userId] } },
      ];
    }

    if (before && ObjectId.isValid(before)) {
      const beforeMessage = await db.collection("messages").findOne({
        _id: new ObjectId(before),
      });
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      } else {
        // If message not found, return empty
        return NextResponse.json({
          messages: [],
          hasMore: false,
        });
      }
    }

    const messages = await db
      .collection("messages")
      .find(query)
      .sort({ createdAt: -1 }) // Sort descending to get newest first
      .limit(limit + 1) // Fetch one extra to check if there are more
      .toArray();

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    if (isAdmin && userId) {
      resultMessages.forEach((msg: any) => {
        msg.isDeleted = msg.deletedFor && msg.deletedFor.length > 0;
      });
    }

    // Reverse to show oldest first in the list (for display)
    resultMessages.reverse();

    return NextResponse.json({
      messages: resultMessages,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST - Create a new message (optionally as reply to another message)
export async function POST(request: NextRequest) {
  try {
    const { senderUserId, text, imageBase64, replyToMessageId } =
      await request.json();

    if (!senderUserId) {
      return NextResponse.json(
        { error: "senderUserId is required" },
        { status: 400 }
      );
    }

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: "Either text or imageBase64 is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const message: Record<string, unknown> = {
      senderUserId,
      text: text || null,
      imageBase64: imageBase64 || null,
      createdAt: new Date(),
    };

    if (replyToMessageId) {
      const { ObjectId } = await import("mongodb");
      if (ObjectId.isValid(replyToMessageId)) {
        const replyToMsg = await db.collection("messages").findOne({
          _id: new ObjectId(replyToMessageId),
        });
        if (replyToMsg) {
          message.replyToMessageId = replyToMessageId;
          message.replyToSenderUserId = replyToMsg.senderUserId;
          const snippet = replyToMsg.text
            ? String(replyToMsg.text).slice(0, 100)
            : replyToMsg.imageBase64
              ? "Photo"
              : "";
          message.replyToText = snippet;
        }
      }
    }

    const result = await db.collection("messages").insertOne(message);

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...message,
    });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

// DELETE - Clear chat: admin hard-deletes; others soft-delete (mark deleted for them)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json().catch(() => ({}));

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    const isAdmin = user?.isAdmin === true;

    if (isAdmin) {
      await db.collection("messages").deleteMany({});
    } else {
      // Soft delete: Mark all messages as deleted for this user
      // Update all messages that don't already have this userId in deletedFor
      await db.collection("messages").updateMany(
        {
          $or: [
            { deletedFor: { $exists: false } },
            { deletedFor: { $nin: [userId] } },
          ],
        },
        {
          $push: { deletedFor: userId },
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
