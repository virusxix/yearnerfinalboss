import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const deviceId = body.device_id as string | undefined;
  const position_ms = typeof body.position_ms === "number" ? body.position_ms : undefined;
  const uri = typeof body.uri === "string" ? body.uri : undefined;
  const context_uri = typeof body.context_uri === "string" ? body.context_uri : undefined;
  const offset = body.offset as { uri?: string; position?: number } | undefined;

  const base = "https://api.spotify.com/v1/me/player";
  let method = "PUT";
  let path = "";
  let fetchBody: string | undefined;

  switch (action) {
    case "play":
      path = "/play";
      if (deviceId) path += `?device_id=${encodeURIComponent(deviceId)}`;
      if (context_uri) {
        const playBody: Record<string, unknown> = { context_uri };
        if (offset) playBody.offset = offset;
        if (position_ms != null) playBody.position_ms = position_ms;
        fetchBody = JSON.stringify(playBody);
      } else if (uri) {
        fetchBody = JSON.stringify({
          uris: [uri],
          position_ms: position_ms ?? 0,
        });
      } else if (position_ms != null) {
        fetchBody = JSON.stringify({ position_ms });
      } else {
        fetchBody = "{}";
      }
      break;
    case "pause":
      path = "/pause";
      if (deviceId) path += `?device_id=${encodeURIComponent(deviceId)}`;
      break;
    case "next":
      method = "POST";
      path = "/next";
      if (deviceId) path += `?device_id=${encodeURIComponent(deviceId)}`;
      break;
    case "previous":
      method = "POST";
      path = "/previous";
      if (deviceId) path += `?device_id=${encodeURIComponent(deviceId)}`;
      break;
    case "seek":
      if (position_ms == null) {
        return NextResponse.json({ error: "position_ms required" }, { status: 400 });
      }
      path = `/seek?position_ms=${Math.floor(position_ms)}`;
      if (deviceId) path += `&device_id=${encodeURIComponent(deviceId)}`;
      break;
    case "transfer":
      if (!deviceId) {
        return NextResponse.json({ error: "device_id required" }, { status: 400 });
      }
      method = "PUT";
      path = "";
      fetchBody = JSON.stringify({ device_ids: [deviceId], play: Boolean(body.play) });
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const url = path ? `${base}${path}` : base;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: fetchBody,
  });

  if (res.status === 204 || res.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { error: await res.text() },
    { status: res.status }
  );
}
