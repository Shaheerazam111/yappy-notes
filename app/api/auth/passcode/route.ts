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
    await db.collection("config").updateOne(
      { key: "passcode" },
      { $set: { key: "passcode", value: envPasscode, updatedAt: new Date() } },
      { upsert: true }
    );
    return envPasscode;
  }

  return null;
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

// PUT - Update passcode (only for user "Shaheer")
export async function PUT(request: NextRequest) {
  try {
    const { passcode, userName } = await request.json();

    if (!passcode || !userName) {
      return NextResponse.json(
        { error: "passcode and userName are required" },
        { status: 400 }
      );
    }

    // Only user "Shaheer" can update passcode
    if (userName !== "Shaheer") {
      return NextResponse.json(
        { error: "Unauthorized: Only Shaheer can update passcode" },
        { status: 403 }
      );
    }

    const db = await getDb();
    await db.collection("config").updateOne(
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
