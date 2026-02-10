import webpush from "web-push";
import { getDb } from "./db";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:app@yappynotes.local",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

/**
 * Send push notifications to all subscribers who have enabled notifications for senderUserId.
 * Called after a new message is created. Free: uses Web Push protocol (no paid service).
 */
export async function sendPushForNewMessage(
  senderUserId: string,
  senderName: string,
  body: string
): Promise<void> {
  if (!isPushConfigured()) return;

  const db = await getDb();
  const subs = await db
    .collection("push_subscriptions")
    .find({
      notifyUserIds: senderUserId,
      "subscription.endpoint": { $exists: true },
    })
    .toArray();

  const payload = JSON.stringify({
    title: "Yappy Notes",
    body: `${senderName}: ${body}`,
    icon: "/icon-192.png",
  });

  type SubDoc = { subscription?: webpush.PushSubscription };
  await Promise.allSettled(
    (subs as SubDoc[]).map((doc) =>
      doc.subscription ? webpush.sendNotification(doc.subscription, payload) : Promise.resolve()
    )
  );
}
