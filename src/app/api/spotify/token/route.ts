import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Short-lived token for Spotify Web Playback SDK (client-side only). */
export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ access_token: token });
}
