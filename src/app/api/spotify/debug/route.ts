import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/* eslint-disable */

export async function GET(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const headers = { Authorization: `Bearer ${token}` };
  const scopeCookie = cookies().get("eh_spotify_scope")?.value ?? null;

  const meRes = await fetch("https://api.spotify.com/v1/me", { headers });
  let me: any = null;
  try { me = await meRes.json(); } catch { me = null; }

  // Get playlists
  const myPlaylistsRes = await fetch(
    "https://api.spotify.com/v1/me/playlists?limit=3",
    { headers }
  );
  let playlists: any[] = [];
  let targetId: string | null = null;
  if (myPlaylistsRes.ok) {
    const data = await myPlaylistsRes.json();
    playlists = (data?.items ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks?.total ?? "unknown",
    }));
    targetId = req.nextUrl.searchParams.get("playlistId")?.trim() || playlists[0]?.id;
  }

  // Deep dive on target playlist
  let deepDive: any = null;
  if (targetId) {
    const objRes = await fetch(
      `https://api.spotify.com/v1/playlists/${targetId}`,
      { headers }
    );
    if (objRes.ok) {
      const obj = await objRes.json();
      const keys = Object.keys(obj ?? {});
      const tracksField = obj?.tracks;
      const itemsField = obj?.items;

      // The paging object could be under "tracks" (standard) or "items" (dev-mode)
      const pagingObj =
        tracksField ??
        (itemsField && typeof itemsField === "object" && !Array.isArray(itemsField)
          ? itemsField
          : null);

      const itemsArray: any[] = Array.isArray(pagingObj?.items)
        ? pagingObj.items
        : Array.isArray(itemsField)
          ? itemsField
          : [];

      let sampleTrack: any = null;
      if (itemsArray.length > 0) {
        const first = itemsArray[0];
        const t = first?.track ?? first?.item ?? first;
        sampleTrack = {
          hasTrackWrapper: !!first?.track,
          name: t?.name ?? "?",
          id: t?.id ?? "?",
          artists: (t?.artists ?? []).map((a: any) => a.name).join(", "),
          itemKeys: Object.keys(first ?? {}),
        };
      }

      deepDive = {
        playlistId: targetId,
        status: objRes.status,
        responseKeys: keys,
        hasTracksKey: keys.includes("tracks"),
        hasItemsKey: keys.includes("items"),
        itemsFieldType: typeof itemsField,
        itemsFieldIsArray: Array.isArray(itemsField),
        pagingObjFound: !!pagingObj,
        pagingTotal: pagingObj?.total ?? "N/A",
        pagingNext: pagingObj?.next ?? "N/A",
        resolvedItemCount: itemsArray.length,
        sampleTrack,
      };
    } else {
      deepDive = { playlistId: targetId, status: objRes.status };
    }
  }

  return NextResponse.json({
    tokenPreview: token.slice(0, 8) + "...",
    grantedScopes: scopeCookie,
    me: me ? { id: me.id, email: me.email, product: me.product } : null,
    playlists,
    deepDive,
  });
}
