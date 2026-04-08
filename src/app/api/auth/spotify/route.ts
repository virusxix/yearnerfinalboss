import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/spotify";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    const msg = encodeURIComponent(
      "Spotify credentials are not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env.local file."
    );
    return NextResponse.redirect(`${base}/?error=${msg}`);
  }

  const state = crypto.randomUUID();
  const store = cookies();
  store.set("eh_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const url = buildAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
