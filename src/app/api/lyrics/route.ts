import { NextRequest, NextResponse } from "next/server";
import { getSpotifyInternalToken } from "@/lib/spotifyLyricsToken";
import { normalizeLyricDisplayText } from "@/lib/lyricSync";

export const dynamic = "force-dynamic";

type LyricLine = { time: number; text: string };

/** Han / CJK symbols + kana (helps match Asian releases in metadata) */
function hasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);
}

function cjkLikelyMetadata(artist: string, track: string): boolean {
  return hasCjk(artist) || hasCjk(track);
}

/** English metadata but likely Asian catalog (romanization-only lyrics on Spotify) */
function mightBeAsianRelease(artist: string, track: string): boolean {
  if (cjkLikelyMetadata(artist, track)) return true;
  const blob = `${artist} ${track}`.toLowerCase();
  if (
    /\b(c-pop|cpop|k-pop|kpop|j-pop|jpop|mandopop|cantopop|mandarin|cantonese|chinese|hokkien|taiwan|hong\s*kong|shanghai|beijing|korean|japanese|anime|ost|国语|粤语|中文|韩文|日文)\b/i.test(
      blob
    )
  ) {
    return true;
  }
  /* Common romanized names (Spotify metadata often Latin-only) */
  return /\b(jay\s*chou|zhou\s*jielun|jj\s*lin|jolin\s*tsai|mayday|s\.h\.e|gem\s*tang|g\.e\.m|wang\s*leehom|leehom\s*wang|khalil\s*fong|eason\s*chan|jacky\s*cheung|andy\s*lau|faye\s*wong|teresa\s*teng)\b/i.test(
    blob
  );
}

/** True if a sample of lines contains Chinese/Japanese/Korean script (not romanization-only) */
function lyricSampleHasCjk(lines: LyricLine[]): boolean {
  const joined = lines
    .slice(0, Math.min(16, lines.length))
    .map((l) => l.text)
    .join("\n");
  return hasCjk(joined);
}

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
    const text = normalizeLyricDisplayText((m[4] || "").trim());
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
        text: normalizeLyricDisplayText((l.words || "").trim()),
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
        lines: plain.map((text, i) => ({
          time: i * 4,
          text: normalizeLyricDisplayText(text),
        })),
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

/** "沉溺（你让我的心不再结冰）" → "沉溺" for better 网易云 hits */
function primaryTitleBeforeParen(title: string): string {
  const idx = title.search(/[（(]/);
  if (idx <= 0) return title.trim();
  return title.slice(0, idx).trim();
}

function buildNeteaseSearchQueries(artist: string, trackRaw: string): string[] {
  const a = artist.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const t = q.trim();
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const cleaned = cleanTrackName(trackRaw);
  const variants = new Set<string>();
  variants.add(trackRaw.trim());
  if (cleaned !== trackRaw) variants.add(cleaned);
  for (const t of variants) {
    push(`${a} ${t}`);
    const short = primaryTitleBeforeParen(t);
    if (short && short !== t) push(`${a} ${short}`);
  }
  return out;
}

function linesFromNeteaseApiPayload(lyricData: {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
}): { lines: LyricLine[]; source: string } | null {
  const lrcRaw = lyricData?.lrc?.lyric;
  const tlyricRaw = lyricData?.tlyric?.lyric;
  const lrcLines = lrcRaw ? parseLRC(lrcRaw) : [];
  const tlLines = tlyricRaw ? parseLRC(tlyricRaw) : [];
  if (lrcLines.length === 0 && tlLines.length === 0) return null;

  const lCjk = lrcLines.length > 0 && lyricSampleHasCjk(lrcLines);
  const tCjk = tlLines.length > 0 && lyricSampleHasCjk(tlLines);

  if (lCjk && !tCjk) return { lines: lrcLines, source: "netease_synced" };
  if (!lCjk && tCjk) return { lines: tlLines, source: "netease_translated" };
  if (lrcLines.length > 0) return { lines: lrcLines, source: "netease_synced" };
  return { lines: tlLines, source: "netease_translated" };
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

type NeteaseSongHit = { id: number; name: string };

const NETEASE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function neteaseSearchSongs(
  searchQuery: string,
  limit: number
): Promise<NeteaseSongHit[]> {
  const body = new URLSearchParams({
    s: searchQuery,
    type: "1",
    limit: String(limit),
  });
  const searchRes = await fetch("https://music.163.com/api/search/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://music.163.com/",
      "User-Agent": NETEASE_UA,
    },
    body: body.toString(),
  });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const songs = searchData?.result?.songs;
  if (!Array.isArray(songs) || songs.length === 0) return [];
  return songs.map((s: { id: number; name: string }) => ({
    id: s.id,
    name: s.name,
  }));
}

async function neteaseLyricsForSongId(
  songId: number
): Promise<{ lines: LyricLine[]; source: string } | null> {
  const lyricRes = await fetch(
    `https://music.163.com/api/song/lyric?id=${songId}&lv=1&tv=1`,
    { headers: { Referer: "https://music.163.com/", "User-Agent": NETEASE_UA } }
  );
  if (!lyricRes.ok) return null;
  const lyricData = await lyricRes.json();
  return linesFromNeteaseApiPayload(lyricData);
}

async function fetchNeteaseLyrics(
  artist: string,
  track: string
): Promise<{ lines: LyricLine[]; source: string } | null> {
  const preferChinese =
    cjkLikelyMetadata(artist, track) || mightBeAsianRelease(artist, track);
  const queries = buildNeteaseSearchQueries(artist, track);
  if (queries.length === 0) return null;

  try {
    for (const searchQuery of queries) {
      const songs = await neteaseSearchSongs(
        searchQuery,
        preferChinese ? 12 : 6
      );
      if (songs.length === 0) {
        console.log(`[Lyrics] Netease: no songs for "${searchQuery}"`);
        continue;
      }

      const scan = preferChinese ? Math.min(8, songs.length) : 1;
      let fallback: { lines: LyricLine[]; source: string } | null = null;

      for (let i = 0; i < scan; i++) {
        const hit = songs[i]!;
        const got = await neteaseLyricsForSongId(hit.id);
        if (!got) continue;
        if (!fallback) fallback = got;
        if (preferChinese && lyricSampleHasCjk(got.lines)) {
          console.log(
            `[Lyrics] Netease pick id=${hit.id} "${hit.name}" (CJK lyrics, q="${searchQuery}")`
          );
          return got;
        }
        if (!preferChinese) {
          console.log(
            `[Lyrics] Netease found song id=${hit.id} ("${hit.name}")`
          );
          return got;
        }
      }

      if (preferChinese && fallback) {
        console.log(
          `[Lyrics] Netease fallback first hit (no CJK in sample) q="${searchQuery}"`
        );
        return fallback;
      }
    }

    console.log("[Lyrics] Netease: no usable lyrics");
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

  const firstArtist = cleanArtistName(artist);
  const cleanedTrack = cleanTrackName(track);
  const cjkMeta = cjkLikelyMetadata(artist, track) || cjkLikelyMetadata(firstArtist, cleanedTrack);

  // 1. Spotify internal (best quality — same lyrics as the Spotify app)
  //    Uses the sp_dc cookie-based internal token, NOT the regular OAuth token
  let spotifyResult: { lines: LyricLine[]; source: string } | null = null;
  if (trackId) {
    const internalToken = await getSpotifyInternalToken();
    if (internalToken) {
      spotifyResult = await fetchSpotifyLyrics(trackId, internalToken);
      if (spotifyResult) {
        console.log(
          `[Lyrics] ✓ Spotify internal (${spotifyResult.source}), ${spotifyResult.lines.length} lines`
        );
      }
    }
  }

  // 1b. Spotify often ships pinyin / romanization for C-pop; Netease usually has 汉字.
  const preferNeteaseOverLatinSpotify =
    spotifyResult &&
    !lyricSampleHasCjk(spotifyResult.lines) &&
    (artist || track) &&
    (cjkMeta || mightBeAsianRelease(artist, track));

  if (preferNeteaseOverLatinSpotify) {
    const neteaseCn = await fetchNeteaseLyrics(
      firstArtist || artist,
      cleanedTrack || track
    );
    if (neteaseCn && lyricSampleHasCjk(neteaseCn.lines)) {
      console.log(
        `[Lyrics] ✓ Prefer Netease (${neteaseCn.source}) over Latin-only Spotify for Asian track`
      );
      return NextResponse.json(neteaseCn);
    }
  }

  if (spotifyResult) {
    return NextResponse.json(spotifyResult);
  }

  // 2. Netease before lrclib when release looks Asian — lrclib often has romanized/English lines
  let triedNeteaseEarly = false;
  if ((cjkMeta || mightBeAsianRelease(artist, track)) && (artist || track)) {
    triedNeteaseEarly = true;
    const earlyNetease = await fetchNeteaseLyrics(
      firstArtist || artist,
      cleanedTrack || track
    );
    if (earlyNetease) {
      console.log(
        `[Lyrics] ✓ Netease early (${earlyNetease.source}), ${earlyNetease.lines.length} lines`
      );
      return NextResponse.json(earlyNetease);
    }
  }

  // 3-6. lrclib fallback chain
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

  // 7. Netease Music (excellent for Chinese, Japanese, Korean songs)
  if (!triedNeteaseEarly && (artist || track)) {
    const netease = await fetchNeteaseLyrics(firstArtist || artist, cleanedTrack || track);
    if (netease) {
      console.log(`[Lyrics] ✓ Netease (${netease.source}), ${netease.lines.length} lines`);
      return NextResponse.json(netease);
    }
  }

  console.log(`[Lyrics] ✗ No lyrics found for "${track}" by "${artist}"`);
  return NextResponse.json({ lines: [], source: "miss" });
}
