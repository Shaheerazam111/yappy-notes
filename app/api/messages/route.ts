import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET - Fetch messages with pagination support
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // Message ID to fetch messages before
    const userId = searchParams.get("userId"); // Current user ID to filter deleted messages
    const userName = searchParams.get("userName"); // Current user name (Bubu or Dudu)

    const db = await getDb();
    let query: any = {};

    // For Dudu: Filter out messages deleted for Dudu
    // For Bubu: Show all messages (including deleted ones) - no filtering
    if (userId && userName !== "Bubu") {
      // All users except Bubu cannot see messages deleted for them
      query.$or = [
        { deletedFor: { $exists: false } },
        { deletedFor: { $nin: [userId] } },
      ];
    }
    // For Bubu, no filtering - show all messages

    // If 'before' is provided, fetch messages created before that message
    if (before) {
      const { ObjectId } = await import("mongodb");
      if (ObjectId.isValid(before)) {
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
    }

    const messages = await db
      .collection("messages")
      .find(query)
      .sort({ createdAt: -1 }) // Sort descending to get newest first
      .limit(limit + 1) // Fetch one extra to check if there are more
      .toArray();

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // For Bubu: Mark deleted messages with isDeleted flag (any message that has been deleted by anyone)
    if (userName === "Bubu" && userId) {
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

// POST - Create a new message
export async function POST(request: NextRequest) {
  try {
    const { senderUserId, text, imageBase64 } = await request.json();

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
    const message = {
      senderUserId,
      text: text || null,
      imageBase64: imageBase64 || null,
      createdAt: new Date(),
    };

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

// DELETE - Delete all messages (clear chat)
export async function DELETE() {
  try {
    const db = await getDb();
    await db.collection("messages").deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
