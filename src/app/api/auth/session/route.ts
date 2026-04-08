import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getValidAccessToken();
  return NextResponse.json({ authenticated: Boolean(token) });
}
