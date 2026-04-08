import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

type TrackDTO = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
  durationMs: number;
  previewUrl: string | null;
};

/**
 * Spotify can return items in two shapes:
 *   Wrapped:  { track: { id, name, ... } }
 *   Flat:     { id, name, uri, ... }          (dev-mode / simplified response)
 */
function normalizeItem(raw: any, idx: number): TrackDTO | null {
  if (!raw) return null;

  const t = raw.track ?? raw.item ?? raw;
  if (!t || typeof t !== "object") return null;
  if (!t.name && !t.uri && !t.id) return null;

  const uri = (t.uri ?? "").trim();
  const trackId = (t.id ?? "").trim() || `${uri || "track"}-${idx}`;
  const albumImages: any[] = t.album?.images ?? [];
  const image: string | null =
    albumImages[0]?.url ?? albumImages[albumImages.length - 1]?.url ?? null;
  const artists =
    (t.artists ?? [])
      .map((a: any) => (a.name ?? "").trim())
      .filter(Boolean)
      .join(", ") || "Unknown Artist";

  return {
    id: trackId,
    uri,
    name: (t.name ?? "").trim() || "Unknown Track",
    artists,
    album: (t.album?.name ?? "").trim() || "Unknown Album",
    image,
    durationMs: t.duration_ms ?? 0,
    previewUrl: t.preview_url ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const playlistId = params.id?.trim() ?? "";
  const token = await getValidAccessToken();

  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!playlistId) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing playlist ID." },
      { status: 400 }
    );
  }

  const headers = { Authorization: `Bearer ${token}` as const };

  try {
    const allRawItems: any[] = [];
    const log: string[] = [];

    // ── Strategy 1: Full playlist object ──
    // Spotify may return tracks as `tracks.items` (standard) OR as
    // top-level `items` (development-mode / simplified response).
    const playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`;
    log.push(`[S1] Fetching: ${playlistUrl}`);
    const playlistRes = await fetch(playlistUrl, { headers });
    log.push(`[S1] Status: ${playlistRes.status}`);

    if (playlistRes.status === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (playlistRes.ok) {
      const data = await playlistRes.json();
      const keys = Object.keys(data ?? {});
      log.push(`[S1] Response keys: ${keys.join(", ")}`);

      // Spotify returns tracks in three possible shapes:
      //   Standard:  data.tracks.items  (tracks is a paging object)
      //   Dev-mode:  data.items.items   (items is a paging object replacing "tracks")
      //   Flat:      data.items         (items is a direct array)
      const tracksObj = data?.tracks;                       // standard
      const itemsField = data?.items;                       // dev-mode renamed field
      const pagingObj = tracksObj ?? (itemsField && typeof itemsField === "object" && !Array.isArray(itemsField) ? itemsField : null);
      const directArray = Array.isArray(itemsField) ? itemsField : null;

      const embeddedItems: any[] = Array.isArray(pagingObj?.items) ? pagingObj.items : (directArray ?? []);
      const nextUrl0: string | null = pagingObj?.next ?? (directArray ? data?.next : null) ?? null;
      const total: number | string = pagingObj?.total ?? data?.total ?? "unknown";

      log.push(
        `[S1] format=${tracksObj ? "standard(tracks)" : itemsField ? (typeof itemsField === "object" && !Array.isArray(itemsField) ? "dev-mode(items=paging)" : "flat(items=array)") : "none"}, ` +
        `embedded=${embeddedItems.length}, total=${total}, next=${nextUrl0 ? "yes" : "none"}`
      );

      if (embeddedItems.length > 0) {
        allRawItems.push(...embeddedItems);

        let nextUrl = nextUrl0;
        while (nextUrl) {
          log.push(`[S1-page] Fetching: ${nextUrl}`);
          const pageRes = await fetch(nextUrl, { headers });
          if (!pageRes.ok) { log.push(`[S1-page] ${pageRes.status} — stopping`); break; }
          const pageData = await pageRes.json();
          const pageItems: any[] = Array.isArray(pageData?.items) ? pageData.items : [];
          allRawItems.push(...pageItems);
          log.push(`[S1-page] Got ${pageItems.length} more`);
          nextUrl = pageData?.next ?? null;
        }
      } else {
        log.push(`[S1] 0 items. tracksExists=${!!tracksObj}, itemsExists=${!!itemsField}, itemsType=${typeof itemsField}, isArray=${Array.isArray(itemsField)}`);
      }
    } else {
      const errText = await playlistRes.text();
      log.push(`[S1] Failed: ${errText}`);
    }

    // ── Strategy 2: Direct /tracks endpoint ──
    if (allRawItems.length === 0) {
      const directUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
      log.push(`[S2] Fetching: ${directUrl}`);
      const directRes = await fetch(directUrl, { headers });
      log.push(`[S2] Status: ${directRes.status}`);

      if (directRes.ok) {
        const directData = await directRes.json();
        const directItems: any[] = directData?.items ?? [];
        allRawItems.push(...directItems);
        log.push(`[S2] Got ${directItems.length} items`);

        let nextUrl: string | null = directData?.next ?? null;
        while (nextUrl) {
          const pageRes = await fetch(nextUrl, { headers });
          if (!pageRes.ok) break;
          const pageData = await pageRes.json();
          allRawItems.push(...(pageData?.items ?? []));
          nextUrl = pageData?.next ?? null;
        }
      } else {
        log.push(`[S2] Failed: ${await directRes.text()}`);
      }
    }

    // ── Strategy 3: /tracks with market=from_token ──
    if (allRawItems.length === 0) {
      const marketUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=from_token`;
      log.push(`[S3] Fetching: ${marketUrl}`);
      const marketRes = await fetch(marketUrl, { headers });
      log.push(`[S3] Status: ${marketRes.status}`);

      if (marketRes.ok) {
        const mData = await marketRes.json();
        allRawItems.push(...(mData?.items ?? []));
        log.push(`[S3] Got ${(mData?.items ?? []).length} items`);
      } else {
        log.push(`[S3] Failed: ${await marketRes.text()}`);
      }
    }

    console.log(`[playlist-tracks] id=${playlistId}\n${log.join("\n")}`);

    if (allRawItems.length === 0) {
      return NextResponse.json(
        {
          error: "no_tracks",
          message:
            "Could not retrieve tracks. Your Spotify app may be in Development Mode — " +
            "ensure Web API is enabled and your email is in User Management on the Spotify Dashboard.",
          debug: log,
        },
        { status: 403 }
      );
    }

    const tracks = allRawItems
      .map((item, idx) => normalizeItem(item, idx))
      .filter((t): t is TrackDTO => t != null);

    return NextResponse.json({
      tracks,
      count: tracks.length,
      playlistId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
