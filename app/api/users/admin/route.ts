import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

// PUT - Set which user is admin (only current admin can assign, or anyone if no admin yet)
export async function PUT(request: NextRequest) {
  try {
    const { adminUserId, requestedByUserId } = await request.json();

    if (!adminUserId) {
      return NextResponse.json(
        { error: "adminUserId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection("users");

    const currentAdmins = await usersCol.find({ isAdmin: true }).toArray();
    const hasAdmin = currentAdmins.length > 0;
    const requester = requestedByUserId
      ? await usersCol.findOne({ _id: new ObjectId(requestedByUserId) })
      : null;
    const isRequesterAdmin = requester?.isAdmin === true;

    if (hasAdmin && !isRequesterAdmin) {
      return NextResponse.json(
        { error: "Only the current admin can assign a new admin" },
        { status: 403 }
      );
    }

    if (!ObjectId.isValid(adminUserId)) {
      return NextResponse.json(
        { error: "Invalid admin user ID" },
        { status: 400 }
      );
    }

    const targetUser = await usersCol.findOne({
      _id: new ObjectId(adminUserId),
    });
    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    await usersCol.updateMany({}, { $set: { isAdmin: false } });
    await usersCol.updateOne(
      { _id: new ObjectId(adminUserId) },
      { $set: { isAdmin: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting admin:", error);
    return NextResponse.json(
      { error: "Failed to set admin" },
      { status: 500 }
    );
  }
}
