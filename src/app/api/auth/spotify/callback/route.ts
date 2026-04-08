import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify";
import { setSpotifyCookies } from "@/lib/cookies";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const retry = url.searchParams.get("retry");

  const store = cookies();
  const expected = store.get("eh_oauth_state")?.value;
  store.delete("eh_oauth_state");

  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  if (err) {
    return NextResponse.redirect(`${base}/?error=${encodeURIComponent(err)}`);
  }
  if (!code || !state || state !== expected) {
    if (retry !== "1") {
      return NextResponse.redirect(`${base}/api/auth/spotify?retry=1`);
    }
    return NextResponse.redirect(
      `${base}/?error=${encodeURIComponent(
        "invalid_state: please sign in again from the same tab and host (localhost)."
      )}`
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    setSpotifyCookies(
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      tokens.scope
    );
    return NextResponse.redirect(`${base}/player`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth_failed";
    return NextResponse.redirect(`${base}/?error=${encodeURIComponent(msg)}`);
  }
}
