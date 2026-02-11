import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isPushConfigured, sendPushForAppOpened } from "@/lib/push";

/**
 * POST - Notify subscribers that this user opened the app (entered passcode).
 * Body: { userId }
 * Sends push "X opened the app" to everyone who has userId in their notifyUserIds.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPushConfigured()) {
      return NextResponse.json({ success: true });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ success: true });
    }

    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    const userName = user?.name ?? "Someone";

    await sendPushForAppOpened(userId, userName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error notifying app opened:", error);
    return NextResponse.json(
      { error: "Failed to notify" },
      { status: 500 }
    );
  }
}
