import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

// DELETE - Delete a user. If they are admin, assign admin to another user first.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { requestedByUserId } = await request.json().catch(() => ({}));

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection("users");
    const target = await usersCol.findOne({ _id: new ObjectId(id) });

    if (!target) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isRequesterAdmin =
      requestedByUserId &&
      ObjectId.isValid(requestedByUserId) &&
      (await usersCol.findOne({ _id: new ObjectId(requestedByUserId) }))?.isAdmin === true;

    if (!isRequesterAdmin) {
      return NextResponse.json(
        { error: "Only admin can delete users" },
        { status: 403 }
      );
    }

    if (target.isAdmin === true) {
      const others = await usersCol
        .find({ _id: { $ne: new ObjectId(id) } })
        .limit(1)
        .toArray();
      if (others.length === 0) {
        return NextResponse.json(
          { error: "Cannot delete the only user. Assign another admin first or reset the app." },
          { status: 400 }
        );
      }
      await usersCol.updateMany({}, { $set: { isAdmin: false } });
      await usersCol.updateOne(
        { _id: others[0]._id },
        { $set: { isAdmin: true } }
      );
    }

    await usersCol.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
