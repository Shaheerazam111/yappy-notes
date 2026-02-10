import { NextResponse } from "next/server";

/**
 * GET - Return VAPID public key for client-side push subscription (free Web Push).
 * Client can use this if NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set at build time.
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "VAPID not configured" },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey: key });
}
