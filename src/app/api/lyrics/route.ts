import { NextRequest, NextResponse } from "next/server";
import { getSpotifyInternalToken } from "@/lib/spotifyLyricsToken";

export const dynamic = "force-dynamic";

type LyricLine = { time: number; text: string };

/* ─── Shared LRC parser ─── */

function parseLRC(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/;
  for (const line of raw.split("\n")) {
    const m = line.trim().match(re);
    if (!m) continue;
    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0;
    const t = mm * 60 + ss + frac / 1000;
    const text = (m[4] || "").trim();
    if (text) lines.push({ time: t, text });
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/* ─── 1. Spotify internal lyrics ─── */

type SpotifyLyricLine = { startTimeMs: string; words: string };
type SpotifyLyricsResponse = {
  lyrics?: { syncType?: string; lines?: SpotifyLyricLine[] };
};

async function fetchSpotifyLyrics(
  trackId: string,
  token: string
): Promise<{ lines: LyricLine[]; source: string } | null> {
  const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false&market=from_token`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "app-platform": "WebPlayer",
        Origin: "https://open.spotify.com",
        Referer: "https://open.spotify.com/",
      },
    });
    if (!res.ok) {
      console.log(`[Lyrics] Spotify internal ${res.status} for ${trackId}`);
      return null;
    }
    const data = (await res.json()) as SpotifyLyricsResponse;
    const rawLines = data?.lyrics?.lines;
    if (!Array.isArray(rawLines) || rawLines.length === 0) return null;

    const isSynced = data.lyrics?.syncType === "LINE_SYNCED";
    const lines: LyricLine[] = rawLines
      .map((l, i) => ({
        time: isSynced ? parseInt(l.startTimeMs, 10) / 1000 : i * 4,
        text: (l.words || "").trim(),
      }))
      .filter((l) => l.text && l.text !== "♪");

    if (lines.length === 0) return null;
    return { lines, source: isSynced ? "spotify_synced" : "spotify_plain" };
  } catch {
    return null;
  }
}

/* ─── 2. lrclib.net ─── */

function extractLrclibLines(data: {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}): { lines: LyricLine[]; source: string } | null {
  if (data.syncedLyrics) {
    const lines = parseLRC(data.syncedLyrics);
    if (lines.length > 0) return { lines, source: "lrclib_synced" };
  }
  if (data.plainLyrics) {
    const plain = data.plainLyrics
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (plain.length > 0) {
      return {
        lines: plain.map((text, i) => ({ time: i * 4, text })),
        source: "lrclib_plain",
      };
    }
  }
  return null;
}

function cleanTrackName(name: string): string {
  return name
    .replace(
      /\s*[\(\[].*?(feat|ft|with|prod|remix|remaster|deluxe|version|edit|mix|live|acoustic|bonus).*?[\)\]]/gi,
      ""
    )
    .replace(/\s*[-–—]\s*(feat|ft)\.?\s.*/i, "")
    .replace(
      /\s*[-–—]\s*(remaster|remastered|deluxe|bonus|live|acoustic).*$/i,
      ""
    )
    .trim();
}

function cleanArtistName(artist: string): string {
  return artist.split(",")[0].trim();
}

async function fetchLrclib(
  artist: string,
  track: string
): Promise<{ lines: LyricLine[]; source: string } | null> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: track,
  });
  try {
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return extractLrclibLines(await res.json());
  } catch {
    return null;
  }
}

async function searchLrclib(
  artist: string,
  track: string
): Promise<{ lines: LyricLine[]; source: string } | null> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${track}`)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results)) return null;
    for (const r of results) {
      const found = extractLrclibLines(r);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

/* ─── 3. Netease Music (great for Chinese / Asian songs) ─── */

async function fetchNeteaseLyrics(
  artist: string,
  track: string
): Promise<{ lines: LyricLine[]; source: string } | null> {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  try {
    const searchQuery = `${artist} ${track}`;
    const body = new URLSearchParams({
      s: searchQuery,
      type: "1",
      limit: "5",
    });
    const searchRes = await fetch("https://music.163.com/api/search/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://music.163.com/",
        "User-Agent": UA,
      },
      body: body.toString(),
    });
    if (!searchRes.ok) {
      console.log(`[Lyrics] Netease search ${searchRes.status}`);
      return null;
    }
    const searchData = await searchRes.json();
    const songs = searchData?.result?.songs;
    if (!Array.isArray(songs) || songs.length === 0) {
      console.log("[Lyrics] Netease search: no songs found");
      return null;
    }

    const songId = songs[0].id;
    console.log(`[Lyrics] Netease found song id=${songId} ("${songs[0].name}")`);

    const lyricRes = await fetch(
      `https://music.163.com/api/song/lyric?id=${songId}&lv=1&tv=1`,
      { headers: { Referer: "https://music.163.com/", "User-Agent": UA } }
    );
    if (!lyricRes.ok) {
      console.log(`[Lyrics] Netease lyric fetch ${lyricRes.status}`);
      return null;
    }
    const lyricData = await lyricRes.json();

    const lrcRaw: string | undefined = lyricData?.lrc?.lyric;
    if (lrcRaw) {
      const lines = parseLRC(lrcRaw);
      if (lines.length > 0) return { lines, source: "netease_synced" };
    }

    const tlyricRaw: string | undefined = lyricData?.tlyric?.lyric;
    if (tlyricRaw) {
      const lines = parseLRC(tlyricRaw);
      if (lines.length > 0) return { lines, source: "netease_translated" };
    }

    console.log("[Lyrics] Netease: song found but no lyrics attached");
    return null;
  } catch (e) {
    console.log("[Lyrics] Netease error:", e);
    return null;
  }
}

/* ─── Main handler ─── */

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist") || "";
  const track = req.nextUrl.searchParams.get("track") || "";
  const trackId = req.nextUrl.searchParams.get("trackId") || "";

  if (!track && !trackId) {
    return NextResponse.json({ lines: [], source: "none" });
  }

  console.log(
    `[Lyrics] Resolving: trackId=${trackId}, artist="${artist}", track="${track}"`
  );

  // 1. Spotify internal (best quality — same lyrics as the Spotify app)
  //    Uses the sp_dc cookie-based internal token, NOT the regular OAuth token
  if (trackId) {
    const internalToken = await getSpotifyInternalToken();
    if (internalToken) {
      const spotify = await fetchSpotifyLyrics(trackId, internalToken);
      if (spotify) {
        console.log(
          `[Lyrics] ✓ Spotify internal (${spotify.source}), ${spotify.lines.length} lines`
        );
        return NextResponse.json(spotify);
      }
    }
  }

  const firstArtist = cleanArtistName(artist);
  const cleanedTrack = cleanTrackName(track);

  // 2-5. lrclib fallback chain
  if (artist && track) {
    const exact = await fetchLrclib(artist, track);
    if (exact) {
      console.log(`[Lyrics] ✓ lrclib exact (${exact.source}), ${exact.lines.length} lines`);
      return NextResponse.json(exact);
    }

    if (firstArtist !== artist) {
      const s2 = await fetchLrclib(firstArtist, track);
      if (s2) {
        console.log(`[Lyrics] ✓ lrclib first-artist (${s2.source}), ${s2.lines.length} lines`);
        return NextResponse.json(s2);
      }
    }

    if (cleanedTrack !== track) {
      const s3 = await fetchLrclib(firstArtist, cleanedTrack);
      if (s3) {
        console.log(`[Lyrics] ✓ lrclib cleaned (${s3.source}), ${s3.lines.length} lines`);
        return NextResponse.json(s3);
      }
    }

    const searched = await searchLrclib(firstArtist, cleanedTrack);
    if (searched) {
      console.log(`[Lyrics] ✓ lrclib search (${searched.source}), ${searched.lines.length} lines`);
      return NextResponse.json(searched);
    }
  }

  // 6. Netease Music (excellent for Chinese, Japanese, Korean songs)
  if (artist || track) {
    const netease = await fetchNeteaseLyrics(firstArtist || artist, cleanedTrack || track);
    if (netease) {
      console.log(`[Lyrics] ✓ Netease (${netease.source}), ${netease.lines.length} lines`);
      return NextResponse.json(netease);
    }
  }

  console.log(`[Lyrics] ✗ No lyrics found for "${track}" by "${artist}"`);
  return NextResponse.json({ lines: [], source: "miss" });
}
