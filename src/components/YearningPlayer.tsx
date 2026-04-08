"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useRouter } from "next/navigation";
import { extractDominantColors } from "@/lib/extractColors";
import { lineIndexAtTime, type LyricLine } from "@/lib/lyricSync";
import {
  useSpotifyWebPlayer,
  type PlayerSnapshot,
  type PlaybackContext,
} from "@/hooks/useSpotifyWebPlayer";
import { useEchoStore, type JournalEntry } from "@/store/useEchoStore";
import { FilmGrain } from "./FilmGrain";
import { LivingAlbumArt } from "./LivingAlbumArt";
import { DualLyric } from "./DualLyric";
import {
  CaptureModal,
  type LyricCaptureContext,
  type PendingCapture,
} from "./CaptureModal";
import { NoteRecall } from "./NoteRecall";

const MeshGradient = dynamic(
  () => import("./MeshGradient").then((m) => m.MeshGradient),
  { ssr: false, loading: () => null }
);
const JournalPanel = dynamic(
  () => import("./JournalPanel").then((m) => m.JournalPanel),
  { ssr: false, loading: () => null }
);
const PlaylistPanel = dynamic<{ deviceId: string | null; performanceMode?: boolean }>(
  () => import("./PlaylistPanel").then((m) => m.PlaylistPanel),
  { ssr: false, loading: () => null }
);

const NO_LYRICS: LyricLine[] = [
  { time: 0, text: "No lyrics available for this track." },
];

function mapApiToSnapshot(data: {
  is_playing?: boolean;
  progress_ms?: number;
  context?: { uri?: string; type?: string } | null;
  item?: {
    id: string;
    uri: string;
    name: string;
    duration_ms?: number;
    artists?: { name: string }[];
    album?: { images?: { url: string }[] };
  } | null;
}): PlayerSnapshot | null {
  const item = data.item;
  if (!item) return null;
  const img =
    item.album?.images?.[0]?.url ?? item.album?.images?.[1]?.url ?? null;
  const ctx: PlaybackContext = data.context?.uri
    ? { uri: data.context.uri, type: data.context.type ?? "playlist" }
    : null;
  return {
    track: {
      id: item.id,
      uri: item.uri,
      name: item.name,
      artists: (item.artists || []).map((a) => a.name).join(", "),
      image: img,
      durationMs: item.duration_ms ?? 0,
    },
    positionMs: data.progress_ms ?? 0,
    isPlaying: Boolean(data.is_playing),
    context: ctx,
  };
}

function snapshotsEqual(a: PlayerSnapshot | null, b: PlayerSnapshot | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.track?.id === b.track?.id &&
    a.positionMs === b.positionMs &&
    a.isPlaying === b.isPlaying
  );
}

async function fetchWeatherSummary(): Promise<string | undefined> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("no_geo"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 600_000,
      });
    });
    const r = await fetch(
      `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
    );
    const j = (await r.json()) as { summary?: string };
    return j.summary;
  } catch {
    const r = await fetch("/api/weather");
    const j = (await r.json()) as { summary?: string };
    return j.summary;
  }
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* ── Progress bar ── */
const ProgressBar = memo(function ProgressBar({
  posRef,
  durationMs,
  onSeek,
}: {
  posRef: React.RefObject<number>;
  durationMs: number;
  onSeek: (ms: number) => void;
}) {
  const rangeRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (durationMs <= 0) return;
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pos = posRef.current ?? 0;
      const pct = Math.min(100, (pos / durationMs) * 100);
      if (rangeRef.current) rangeRef.current.value = String(pct);
      if (startRef.current) startRef.current.textContent = formatMs(pos);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, posRef]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const ms = (Number(e.target.value) / 100) * durationMs;
      onSeek(ms);
    },
    [durationMs, onSeek]
  );

  return (
    <div className="flex w-full items-center gap-3 font-sans text-[10px] text-white/40">
      <span ref={startRef}>0:00</span>
      <input
        ref={rangeRef}
        type="range"
        min={0}
        max={100}
        step={0.2}
        defaultValue={0}
        onChange={onChange}
        className="h-1 flex-1 cursor-pointer accent-violet-300/80"
      />
      <span>{formatMs(durationMs)}</span>
    </div>
  );
});

/* ── Main player ── */
export function YearningPlayer() {
  const router = useRouter();
  const addEntry = useEchoStore((s) => s.addEntry);
  const performanceMode = useEchoStore((s) => s.performanceMode);

  const {
    deviceId,
    ready,
    sdkError,
    snapshot,
    togglePlay,
    next,
    prev,
    seek,
    volume,
    setVolume,
  } = useSpotifyWebPlayer();

  const [remote, setRemote] = useState<PlayerSnapshot | null>(null);
  const [colors, setColors] = useState<string[]>([
    "#1a1025",
    "#2d1f3d",
    "#0d1a2b",
    "#3d2438",
  ]);
  const [lyricsOn, setLyricsOn] = useState(true);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [lineIdx, setLineIdx] = useState(-1);
  const displayPosRef = useRef(0);
  const lastTick = useRef(Date.now());

  const active = snapshot.track ? snapshot : remote;

  const [contextName, setContextName] = useState<string | null>(null);
  const contextCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const ctx = active?.context;
    if (!ctx?.uri) { setContextName(null); return; }

    const cached = contextCacheRef.current.get(ctx.uri);
    if (cached) { setContextName(cached); return; }

    if (!ctx.uri.startsWith("spotify:playlist:")) {
      const type = ctx.uri.split(":")[1] ?? "context";
      setContextName(type.charAt(0).toUpperCase() + type.slice(1));
      return;
    }

    const playlistId = ctx.uri.split(":")[2];
    if (!playlistId) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/spotify/playlists", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { playlists: { id: string; name: string; uri: string }[] };
        for (const p of data.playlists) {
          contextCacheRef.current.set(p.uri, p.name);
        }
        if (!cancelled) {
          setContextName(contextCacheRef.current.get(ctx.uri) ?? "Playlist");
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [active?.context?.uri]);

  const lastRemoteRef = useRef<PlayerSnapshot | null>(null);
  useEffect(() => {
    let mounted = true;
    let abortCtrl: AbortController | null = null;
    const poll = async () => {
      try {
        abortCtrl?.abort();
        abortCtrl = new AbortController();
        const r = await fetch("/api/spotify/current", {
          cache: "no-store",
          signal: abortCtrl.signal,
        });
        if (!r.ok) return;
        const data = await r.json();
        const mapped = mapApiToSnapshot(data);
        if (!snapshotsEqual(lastRemoteRef.current, mapped)) {
          lastRemoteRef.current = mapped;
          if (mounted) setRemote(mapped);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = window.setInterval(
      () => void poll(),
      snapshot.track ? 9000 : 3500
    );
    return () => {
      mounted = false;
      clearInterval(id);
      abortCtrl?.abort();
    };
  }, [snapshot.track]);

  useEffect(() => {
    displayPosRef.current = active?.positionMs ?? 0;
    lastTick.current = Date.now();
  }, [active?.positionMs, active?.track?.id]);

  useEffect(() => {
    const durationMs = active?.track?.durationMs ?? 0;
    const trackId = active?.track?.id;
    if (!trackId || durationMs <= 0) return;

    let raf: number;
    let prevIdx = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (active?.isPlaying) {
        const now = Date.now();
        const dt = now - lastTick.current;
        lastTick.current = now;
        displayPosRef.current = Math.min(
          displayPosRef.current + dt,
          durationMs
        );
      }
      const tSec = displayPosRef.current / 1000;
      const idx = lineIndexAtTime(lines, tSec);
      if (idx !== prevIdx) {
        prevIdx = idx;
        setLineIdx(idx);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active?.isPlaying, active?.track?.id, active?.track?.durationMs, lines]);

  useEffect(() => {
    const trackId = active?.track?.id;
    const trackName = active?.track?.name;
    const trackArtists = active?.track?.artists;
    if (!trackId || !trackName) {
      setLines([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(
        `/api/lyrics?artist=${encodeURIComponent(trackArtists ?? "")}&track=${encodeURIComponent(trackName)}&trackId=${encodeURIComponent(trackId)}`
      );
      const j = (await r.json()) as {
        lines?: LyricLine[];
      };
      if (cancelled) return;
      setLines(j.lines?.length ? j.lines : NO_LYRICS);
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.track?.id, active?.track?.name, active?.track?.artists]);

  useEffect(() => {
    const url = active?.track?.image;
    if (!url) return;
    let cancelled = false;
    void extractDominantColors(url).then((c) => {
      if (!cancelled) setColors(c);
    });
    return () => {
      cancelled = true;
    };
  }, [active?.track?.image]);

  const prevLine =
    lineIdx > 0 && lines[lineIdx - 1] ? lines[lineIdx - 1]!.text : null;
  const currentLine =
    lineIdx >= 0 && lines[lineIdx] ? lines[lineIdx]!.text : null;
  const nextLine =
    lineIdx >= 0 && lines[lineIdx + 1] ? lines[lineIdx + 1]!.text : null;
  const afterNextLine =
    lineIdx >= 0 && lines[lineIdx + 2] ? lines[lineIdx + 2]!.text : null;

  const onSeek = useCallback(
    (ms: number) => {
      displayPosRef.current = ms;
      seek(ms);
      void fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "seek",
          position_ms: ms,
          device_id: deviceId,
        }),
      });
    },
    [seek, deviceId]
  );

  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);

  const captureLine = useCallback(async (ctx: LyricCaptureContext) => {
    const line = ctx.line?.trim();
    if (!active?.track || !line) return;
    let weather: string | undefined;
    try {
      weather = await fetchWeatherSummary();
    } catch {
      weather = undefined;
    }
    setPendingCapture({
      lyricLine: line,
      adjacentPrevLine: ctx.prevLine?.trim() || undefined,
      adjacentNextLine: ctx.nextLine?.trim() || undefined,
      songTitle: active.track.name,
      artist: active.track.artists,
      trackUri: active.track.uri,
      positionMs: Math.floor(displayPosRef.current),
      weather,
    });
  }, [active?.track]);

  const handleCaptureSave = useCallback(
    (data: PendingCapture & { forWhom?: string; feeling?: string }) => {
      addEntry({
        songTitle: data.songTitle,
        artist: data.artist,
        lyricLine: data.lyricLine,
        positionMs: data.positionMs,
        trackUri: data.trackUri,
        capturedAt: new Date().toISOString(),
        weather: data.weather,
        forWhom: data.forWhom,
        feeling: data.feeling,
      });
    },
    [addEntry]
  );

  const handleCaptureClose = useCallback(() => {
    setPendingCapture(null);
  }, []);

  const onJournalReplay = useCallback(
    async (entry: JournalEntry) => {
      if (!deviceId) return;
      await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          uri: entry.trackUri,
          position_ms: entry.positionMs,
          device_id: deviceId,
        }),
      });
    },
    [deviceId]
  );

  const onSeekReplay = useCallback(
    async (trackUri: string, positionMs: number) => {
      if (!deviceId) return;
      await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          uri: trackUri,
          position_ms: positionMs,
          device_id: deviceId,
        }),
      });
    },
    [deviceId]
  );

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const trackImage = active?.track?.image ?? null;
  const durationMs = active?.track?.durationMs ?? 0;

  return (
    <motion.div
      className="relative min-h-screen overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <MeshGradient colors={colors} reducedMotion={performanceMode} />
      <FilmGrain staticOnly={performanceMode} />

      {/* Note Recall — resurfaces captured journal notes for the current song */}
      <NoteRecall
        songId={active?.track?.id ?? null}
        currentPosMs={displayPosRef}
        onSeek={onSeekReplay}
      />

      {/* Top-left controls */}
      <div className="fixed left-6 top-6 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest text-white/45 backdrop-blur-md transition-colors hover:text-white/80"
        >
          Leave
        </button>
        <PlaylistPanel deviceId={deviceId} performanceMode={performanceMode} />
      </div>

      {/* Top-right controls */}
      <div className="fixed right-6 top-6 z-40 flex items-center gap-2">
        <JournalPanel deviceId={deviceId} onReplay={onJournalReplay} />
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-28 pt-20">
        {!active?.track ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="max-w-md text-center"
          >
            <p className="font-serif text-2xl text-white/80 md:text-3xl">
              Nothing is playing yet.
            </p>
            <p className="mt-4 font-sans text-sm leading-relaxed text-white/45">
              Open Spotify, start a track, then transfer playback to{" "}
              <span className="text-white/70">Echo &amp; Haze</span> from your
              devices menu—or press play here once this web player is active.
            </p>
            {sdkError ? (
              <p className="mt-4 font-sans text-xs text-amber-200/70">
                Player: {sdkError} (Premium + Web Playback required in your
                market.)
              </p>
            ) : !ready ? (
              <p className="mt-4 font-sans text-xs text-white/35">
                Waking the web player…
              </p>
            ) : null}
          </motion.div>
        ) : (
          <>
            {trackImage ? (
              <LivingAlbumArt
                image={trackImage}
                colors={colors}
                lyricsAmbient={lyricsOn}
              />
            ) : null}

            {trackImage && lyricsOn ? (
              <div
                className="pointer-events-none fixed inset-0 -z-[6]"
                style={{
                  background: `radial-gradient(ellipse 95% 72% at 50% 36%, ${colors[0] ?? "#1a1025"}26, transparent 58%)`,
                }}
                aria-hidden
              />
            ) : null}

            <AnimatePresence mode="wait">
              {contextName ? (
                <motion.p
                  key={contextName}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.6 }}
                  className="mb-3 font-sans text-[9px] uppercase tracking-[0.35em] text-violet-200/40"
                >
                  Playing from <span className="text-violet-200/60">{contextName}</span>
                </motion.p>
              ) : null}
            </AnimatePresence>

            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.3em] text-white/35">
              {active.track.artists}
            </p>
            <p className="mb-8 font-serif text-sm text-white/50 md:text-base">
              {active.track.name}
            </p>

            {lyricsOn && (
              <DualLyric
                lineIdx={lineIdx}
                prevText={prevLine}
                text={currentLine}
                nextText={nextLine}
                afterNextText={afterNextLine}
                trackId={active.track.id}
                reducedMotion={performanceMode}
                onCapture={(ctx) => void captureLine(ctx)}
              />
            )}
          </>
        )}
      </div>

      {/* Playback controls — always visible */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5 px-6 pb-6">
          {/* Lyrics toggle */}
          <button
            type="button"
            onClick={() => setLyricsOn((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] tracking-wide transition-all ${
              lyricsOn
                ? "bg-white/10 text-white/80"
                : "bg-white/5 text-white/30"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v11.75A2.75 2.75 0 0 0 16.75 18h-12A2.75 2.75 0 0 1 2 15.25V3.5Zm3.75 7a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM5 6.75A.75.75 0 0 1 5.75 6h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 6.75Z" clipRule="evenodd" />
              <path d="M16.5 6.5h-1v8.75a1.25 1.25 0 1 0 2.5 0V8a1.5 1.5 0 0 0-1.5-1.5Z" />
            </svg>
            {lyricsOn ? "Lyrics" : "Lyrics off"}
          </button>

          {active?.track ? (
            <ProgressBar
              posRef={displayPosRef}
              durationMs={durationMs}
              onSeek={onSeek}
            />
          ) : null}
          <div className="flex w-full items-center justify-between">
            {/* Volume down */}
            <button
              type="button"
              aria-label="Volume down"
              onClick={() => setVolume(volume - 0.1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" />
              </svg>
            </button>

            {/* Transport controls */}
            <div className="flex items-center gap-5">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => prev()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V7.19c0-1.44-1.555-2.343-2.805-1.628L12 9.54V7.19c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={active?.isPlaying ? "Pause" : "Play"}
                onClick={() => togglePlay()}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/90 transition-colors hover:border-white/40 hover:text-white"
              >
                {active?.isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 ml-0.5">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => next()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v6.622c0 1.44 1.555 2.343 2.805 1.628L12 12.872v2.128c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.06C13.555 4.846 12 5.75 12 7.19v2.13L5.055 5.432a.187.187 0 0 0 0 1.628Z" />
                </svg>
              </button>
            </div>

            {/* Volume up */}
            <button
              type="button"
              aria-label="Volume up"
              onClick={() => setVolume(volume + 0.1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Capture modal — shown when a lyric is tapped */}
      <CaptureModal
        pending={pendingCapture}
        onSave={handleCaptureSave}
        onClose={handleCaptureClose}
      />
    </motion.div>
  );
}
