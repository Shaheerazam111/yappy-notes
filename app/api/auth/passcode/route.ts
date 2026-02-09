import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET - Get passcode from DB or ENV
async function getPasscode(): Promise<string | null> {
  const db = await getDb();
  const config = await db.collection("config").findOne({ key: "passcode" });

  if (config && config.value) {
    return config.value;
  }

  // If not in DB, use ENV and save to DB
  const envPasscode = process.env.CHAT_PASSCODE;
  if (envPasscode) {
    await db
      .collection("config")
      .updateOne(
        { key: "passcode" },
        {
          $set: { key: "passcode", value: envPasscode, updatedAt: new Date() },
        },
        { upsert: true }
      );
    return envPasscode;
  }

  return null;
}

// GET - Get passcode (for display purposes)
export async function GET() {
  try {
    const passcode = await getPasscode();
    if (!passcode) {
      return NextResponse.json(
        { error: "Passcode not configured" },
        { status: 500 }
      );
    }
    return NextResponse.json({ passcode });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get passcode" },
      { status: 500 }
    );
  }
}

// POST - Verify passcode
export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    const correctPasscode = await getPasscode();

    if (!correctPasscode) {
      return NextResponse.json(
        { error: "Passcode not configured" },
        { status: 500 }
      );
    }

    if (passcode === correctPasscode) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Incorrect passcode" },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { passcode, userId } = await request.json();

    if (!passcode || !userId) {
      return NextResponse.json(
        { error: "passcode and userId are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Invalid userId" },
        { status: 400 }
      );
    }
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (user?.isAdmin !== true) {
      return NextResponse.json(
        { error: "Unauthorized: Only admin can update passcode" },
        { status: 403 }
      );
    }
    await db
      .collection("config")
      .updateOne(
        { key: "passcode" },
        { $set: { key: "passcode", value: passcode, updatedAt: new Date() } },
        { upsert: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating passcode:", error);
    return NextResponse.json(
      { error: "Failed to update passcode" },
      { status: 500 }
    );
  }
}
