import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

// DELETE - Soft delete a single message by ID (both Bubu and Dudu can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, userName } = await request.json().catch(() => ({}));

    if (!id) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    // Both Bubu and Dudu can delete messages
    if (userName !== "Bubu" && userName !== "Dudu") {
      return NextResponse.json(
        { error: "Unauthorized: Only Bubu and Dudu can delete messages" },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 }
      );
    }

    // Soft delete: Add user to deletedFor array instead of actually deleting
    const message = await db.collection("messages").findOne({
      _id: new ObjectId(id),
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Initialize deletedFor array if it doesn't exist
    const deletedFor = message.deletedFor || [];

    // Add user ID to deletedFor if not already present
    if (!deletedFor.includes(userId)) {
      await db
        .collection("messages")
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { deletedFor: [...deletedFor, userId] } }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
