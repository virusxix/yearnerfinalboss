import { NextResponse } from "next/server";
import { clearSpotifyCookies } from "@/lib/cookies";

export const dynamic = "force-dynamic";

export async function POST() {
  clearSpotifyCookies();
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  clearSpotifyCookies();
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  return NextResponse.redirect(`${base}/`);
}
