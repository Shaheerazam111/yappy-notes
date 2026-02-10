import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST - Save or update push subscription for a user (free Web Push, no paid service).
 * Body: { userId, subscription, notifyUserIds }
 * When the user enables "notify for user X", we store their subscription and notifyUserIds
 * so we can send them a push when user X sends a message.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, subscription, notifyUserIds } = await request.json();

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "userId and subscription (with endpoint) are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const payload = {
      userId,
      subscription: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime ?? null,
      },
      notifyUserIds: Array.isArray(notifyUserIds) ? notifyUserIds : [],
      updatedAt: new Date(),
    };

    await db.collection("push_subscriptions").updateOne(
      { "subscription.endpoint": subscription.endpoint },
      { $set: payload },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
