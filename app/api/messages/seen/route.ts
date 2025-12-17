import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// POST - Mark messages as seen by a user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const now = new Date();

    // Mark all messages from other users as seen
    const result = await db.collection("messages").updateMany(
      {
        senderUserId: { $ne: userId }, // Messages not from this user
        seenAt: { $exists: false }, // Not already seen
      },
      {
        $set: { seenAt: now },
      }
    );

    return NextResponse.json({
      success: true,
      markedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking messages as seen:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as seen" },
      { status: 500 }
    );
  }
}

