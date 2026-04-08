"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { List, type RowComponentProps } from "react-window";
import { extractDominantColors } from "@/lib/extractColors";

type Playlist = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  trackCount: number;
  uri: string;
  owner: string;
};

type Track = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
  durationMs: number;
  previewUrl: string | null;
};

type Props = {
  deviceId: string | null;
  performanceMode?: boolean;
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function hashSeed(input: string) {
  return Array.from(input).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function stripHtmlTags(text: string | null) {
  if (!text) return null;
  return text.replace(/<[^>]+>/g, "").trim() || null;
}

function cardPose(seed: number) {
  return {
    rotate: (seed % 9) - 4,
    x: ((seed % 7) - 3) * 6,
    y: ((seed % 5) - 2) * 10,
  };
}

type RowData = {
  tracks: Track[];
  deviceId: string | null;
  selectedPlaylistUri: string;
  previewTrackId: string | null;
  playTrack: (trackUri: string, contextUri: string) => Promise<void>;
  triggerPreview: (track: Track) => void;
};

function TrackRowInner({
  t,
  index,
  style,
  canPlay,
  selectedPlaylistUri,
  previewTrackId,
  playTrack,
  triggerPreview,
}: {
  t: Track;
  index: number;
  style?: React.CSSProperties;
  canPlay: boolean;
  selectedPlaylistUri: string;
  previewTrackId: string | null;
  playTrack: (trackUri: string, contextUri: string) => Promise<void>;
  triggerPreview: (track: Track) => void;
}) {
  return (
    <div style={style} className="px-0.5">
      <div className="group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all duration-500 hover:border-violet-200/15 hover:bg-white/[0.06] hover:shadow-[0_8px_26px_rgba(130,90,200,0.2)]">
        <span className="w-5 text-right font-mono text-[10px] text-white/20">
          {index + 1}
        </span>
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
          {t.image ? (
            <Image
              src={t.image}
              alt={t.album}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="40px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/15">♪</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-sm text-white/80 transition-colors group-hover:text-white/95">
            {t.name}
          </p>
          <p className="truncate font-sans text-[10px] text-white/30">{t.artists}</p>
        </div>
        <span className="pr-20 flex-shrink-0 font-mono text-[10px] text-white/20">
          {formatDuration(t.durationMs)}
        </span>

        <button
          type="button"
          disabled={!canPlay}
          onClick={() => void playTrack(t.uri, selectedPlaylistUri)}
          className="absolute inset-0 rounded-xl disabled:cursor-not-allowed"
          aria-label={`Play ${t.name}`}
        />

        {t.previewUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerPreview(t);
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-1.5 text-white/70 opacity-0 backdrop-blur-md transition-all duration-400 group-hover:opacity-100 hover:text-white"
            aria-label={`Preview ${t.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M4.5 3.5a.5.5 0 0 1 .77-.42l6 4a.5.5 0 0 1 0 .84l-6 4A.5.5 0 0 1 4.5 11.5v-8Z" />
            </svg>
          </button>
        ) : null}

        {previewTrackId === t.id ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-[9px] uppercase tracking-widest text-violet-200/70">
            Previewing
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TrackRow({
  index,
  style,
  tracks,
  deviceId,
  selectedPlaylistUri,
  previewTrackId,
  playTrack,
  triggerPreview,
}: RowComponentProps<RowData>) {
  const t = tracks[index];
  if (!t) return null;
  const canPlay = Boolean(deviceId && t.uri);
  return (
    <TrackRowInner
      t={t}
      index={index}
      style={style}
      canPlay={canPlay}
      selectedPlaylistUri={selectedPlaylistUri}
      previewTrackId={previewTrackId}
      playTrack={playTrack}
      triggerPreview={triggerPreview}
    />
  );
}

export const PlaylistPanel = memo(function PlaylistPanel({
  deviceId,
  performanceMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>([
    "#1a1025",
    "#2d1f3d",
    "#0d1a2b",
    "#3d2438",
  ]);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const trackCacheRef = useRef<Map<string, Track[]>>(new Map());
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const r = await fetch("/api/spotify/playlists", { cache: "no-store" });
        if (r.status === 401) throw new Error("Session expired — click Leave and log back in.");
        if (r.status === 403) throw new Error("Missing playlist permissions — log out and log back in.");
        if (!r.ok) throw new Error(`Failed to load playlists (${r.status})`);
        const data = (await r.json()) as { playlists: Playlist[] };
        if (!cancelled) setPlaylists(data.playlists);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!selectedPlaylist?.image) {
      setPalette(["#1a1025", "#2d1f3d", "#0d1a2b", "#3d2438"]);
      return;
    }
    let cancelled = false;
    void extractDominantColors(selectedPlaylist.image, 4).then((colors) => {
      if (!cancelled) setPalette(colors);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylist?.image]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const openPlaylist = useCallback((playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setTracksError(null);
    setPreviewTrackId(null);

    const cached = trackCacheRef.current.get(playlist.id);
    if (cached) {
      setTracks(cached);
      setTracksLoading(false);
      return;
    }

    setTracks([]);
    setTracksLoading(true);

    (async () => {
      try {
        const r = await fetch(`/api/spotify/playlists/${playlist.id}/tracks`, { cache: "no-store" });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
            status?: number;
          };
          const msg =
            err.message ||
            err.error ||
            `Failed to load tracks (${r.status})`;
          throw new Error(msg);
        }
        const data = (await r.json()) as { tracks: Track[] };
        console.log("[PlaylistPanel] tracks loaded", {
          playlistId: playlist.id,
          count: data.tracks?.length ?? 0,
          sample: data.tracks?.[0],
        });
        trackCacheRef.current.set(playlist.id, data.tracks);
        setTracks(data.tracks);
      } catch (e) {
        setTracksError(e instanceof Error ? e.message : "Failed");
      } finally {
        setTracksLoading(false);
      }
    })();
  }, []);

  const goBack = useCallback(() => {
    setSelectedPlaylist(null);
    setTracks([]);
    setTracksError(null);
    setPreviewTrackId(null);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, []);

  const playTrack = useCallback(
    async (trackUri: string, contextUri: string) => {
      if (!deviceId) return;
      await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          context_uri: contextUri,
          uri: undefined,
          device_id: deviceId,
          offset: { uri: trackUri },
        }),
      });
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setOpen(false);
    },
    [deviceId]
  );

  const shufflePlaylist = useCallback(
    async (contextUri: string) => {
      if (!deviceId) return;
      await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "play",
          context_uri: contextUri,
          device_id: deviceId,
        }),
      });
      setOpen(false);
    },
    [deviceId]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setSelectedPlaylist(null);
    setTracks([]);
    setPreviewTrackId(null);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, []);

  const triggerPreview = useCallback((track: Track) => {
    if (!track.previewUrl) return;
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.previewUrl);
      audio.volume = 0.34;
      void audio.play();
      audio.onended = () => setPreviewTrackId(null);
      previewAudioRef.current = audio;
      setPreviewTrackId(track.id);
      window.setTimeout(() => {
        setPreviewTrackId((current) => (current === track.id ? null : current));
      }, 30_000);
    } catch {
      setPreviewTrackId(null);
    }
  }, []);

  const meshStyle = useMemo(() => {
    return {
      background: `radial-gradient(circle at 12% 20%, ${palette[0]}99 0%, transparent 52%),
      radial-gradient(circle at 86% 8%, ${palette[1]}88 0%, transparent 46%),
      radial-gradient(circle at 55% 84%, ${palette[2]}7A 0%, transparent 58%),
      radial-gradient(circle at 84% 70%, ${palette[3]}72 0%, transparent 52%)`,
    };
  }, [palette]);
  const noiseStyle = useMemo(
    () => ({
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E\")",
    }),
    []
  );

  const trackRowData = useMemo<RowData>(
    () => ({
      tracks,
      deviceId,
      selectedPlaylistUri: selectedPlaylist?.uri ?? "",
      previewTrackId,
      playTrack,
      triggerPreview,
    }),
    [tracks, deviceId, selectedPlaylist?.uri, previewTrackId, playTrack, triggerPreview]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-sans text-[10px] uppercase tracking-widest text-white/45 backdrop-blur-md transition-colors hover:text-white/80"
      >
        Playlists
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close playlists"
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              onClick={handleClose}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="playlist-title"
              initial={{ x: "10%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "8%", opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-white/10 bg-[#0c0812]/70 shadow-[-40px_0_120px_rgba(0,0,0,0.55)] md:w-[34rem] ${performanceMode ? "backdrop-blur-md" : "backdrop-blur-2xl"}`}
            >
              <div className="pointer-events-none absolute inset-0 opacity-80" style={meshStyle} />
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={noiseStyle} />

              {/* ── Header ── */}
              <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-8 md:py-6">
                <div className="flex items-center gap-3">
                  {selectedPlaylist ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:text-white/90"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : null}
                  <div>
                    <h2
                      id="playlist-title"
                      className="font-serif text-xl text-white/95"
                    >
                      {selectedPlaylist ? selectedPlaylist.name : "Your Playlists"}
                    </h2>
                    <p className="mt-0.5 font-sans text-[10px] text-white/40">
                      {selectedPlaylist
                        ? `${selectedPlaylist.owner}${tracks.length > 0 ? ` · ${tracks.length} tracks` : selectedPlaylist.trackCount > 0 ? ` · ${selectedPlaylist.trackCount} tracks` : ""}`
                        : "Pick something to get lost in."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-white/15 px-3 py-1 font-sans text-xs text-white/60 transition-colors hover:text-white/90"
                >
                  Close
                </button>
              </header>

              {/* ── Content ── */}
              <div className="relative z-10 flex-1 overflow-y-auto px-5 py-6 md:px-6">
                <AnimatePresence mode="wait">
                  {!selectedPlaylist ? (
                    /* ── Floating playlist cards ── */
                    <motion.div
                      key="playlists"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.55 }}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center py-20">
                          <p className="font-sans text-sm text-white/30">Loading playlists…</p>
                        </div>
                      ) : error ? (
                        <p className="font-sans text-sm text-red-300/70">{error}</p>
                      ) : playlists.length === 0 ? (
                        <p className="font-serif text-lg text-white/30">
                          No playlists found on your account.
                        </p>
                      ) : (
                        <ul className="flex flex-wrap items-start gap-4 pb-10">
                          {playlists.map((p, i) => {
                            const pose = cardPose(hashSeed(p.id));
                            return (
                            <motion.li
                              key={p.id}
                              initial={{ opacity: 0, y: 16, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                delay: i * 0.03,
                                duration: 0.7,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              style={{
                                width: "calc(50% - 0.5rem)",
                                marginTop: pose.y,
                                marginLeft: pose.x,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openPlaylist(p)}
                                style={{ rotate: `${pose.rotate}deg` }}
                                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-3xl border border-white/15 bg-white/[0.08] px-4 py-3 text-left shadow-[0_10px_40px_rgba(55,35,88,0.3)] transition-all duration-700 hover:-translate-y-1 hover:border-violet-200/30 hover:bg-white/[0.12] hover:shadow-[0_18px_60px_rgba(128,88,200,0.42)] ${performanceMode ? "backdrop-blur-sm" : "backdrop-blur-xl"}`}
                              >
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-violet-400/10 opacity-70 transition-opacity duration-700 group-hover:opacity-100" />
                                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
                                  {p.image ? (
                                    <Image
                                      src={p.image}
                                      alt={p.name}
                                      fill
                                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                                      sizes="56px"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center font-serif text-lg text-white/20">
                                      ♪
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-sans text-sm font-medium text-white/90">
                                    {p.name}
                                  </p>
                                  <p className="mt-0.5 truncate font-sans text-[10px] text-white/35">
                                    {p.trackCount > 0 ? `${p.trackCount} tracks` : "Playlist"}
                                  </p>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 flex-shrink-0 text-white/20 transition-colors group-hover:text-white/50">
                                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </motion.li>
                            );
                          })}
                        </ul>
                      )}
                    </motion.div>
                  ) : (
                    /* ── Track list ── */
                    <motion.div
                      key="tracks"
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 }}
                      transition={{ duration: 0.6 }}
                    >
                      {selectedPlaylist.image ? (
                        <div className="relative mb-5 overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                          <div className="absolute inset-0">
                            <Image
                              src={selectedPlaylist.image}
                              alt={selectedPlaylist.name}
                              fill
                              className="object-cover blur-2xl scale-110 opacity-55"
                              sizes="(max-width: 768px) 100vw, 480px"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/75" />
                          </div>
                          <div className="relative z-10 flex items-end gap-4 px-4 pb-4 pt-14">
                            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/15">
                              <Image
                                src={selectedPlaylist.image}
                                alt={selectedPlaylist.name}
                                fill
                                className="object-cover"
                                sizes="80px"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-serif text-2xl text-white/95">
                                {selectedPlaylist.name}
                              </p>
                              {stripHtmlTags(selectedPlaylist.description) ? (
                                <p className="max-h-8 overflow-hidden pt-1 font-sans text-xs text-white/60">
                                  {stripHtmlTags(selectedPlaylist.description)}
                                </p>
                              ) : null}
                              <p className="pt-2 font-sans text-[10px] uppercase tracking-[0.2em] text-white/50">
                                {tracks.length > 0 ? `${tracks.length} tracks` : selectedPlaylist.trackCount > 0 ? `${selectedPlaylist.trackCount} tracks` : "Playlist"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Play all button */}
                      {!tracksLoading && tracks.length > 0 ? (
                        <button
                          type="button"
                          disabled={!deviceId}
                          onClick={() => void shufflePlaylist(selectedPlaylist.uri)}
                          className="mb-5 w-full rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-3 font-sans text-xs uppercase tracking-widest text-white/70 transition-all duration-500 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Play all
                        </button>
                      ) : null}

                      {tracksLoading ? (
                        <div className="flex items-center justify-center py-20">
                          <p className="font-sans text-sm text-white/30">Loading tracks…</p>
                        </div>
                      ) : tracksError ? (
                        <div className="space-y-6 py-10 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-white/25">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-serif text-lg text-white/70">
                              Track listing locked
                            </p>
                            <p className="mx-auto max-w-[16rem] font-sans text-xs leading-relaxed text-white/35">
                              Spotify restricts track details for playlists by other creators in development mode. You can still play the full playlist.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!deviceId}
                            onClick={() => void shufflePlaylist(selectedPlaylist.uri)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-8 py-3.5 font-sans text-xs uppercase tracking-widest text-white/80 transition-all duration-500 hover:bg-violet-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M4.5 3.5a.5.5 0 0 1 .77-.42l6 4a.5.5 0 0 1 0 .84l-6 4A.5.5 0 0 1 4.5 11.5v-8Z" />
                            </svg>
                            Play Playlist
                          </button>
                        </div>
                      ) : tracks.length === 0 ? (
                        <p className="font-serif text-lg text-white/30">
                          This playlist is empty.
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-xl">
                          {tracks.length < 100000 ? (
                            <div className="space-y-1.5">
                              {tracks.map((t, index) => (
                                <TrackRowInner
                                  key={`${t.id}-${index}`}
                                  t={t}
                                  index={index}
                                  canPlay={Boolean(deviceId && t.uri)}
                                  selectedPlaylistUri={selectedPlaylist.uri}
                                  previewTrackId={previewTrackId}
                                  playTrack={playTrack}
                                  triggerPreview={triggerPreview}
                                />
                              ))}
                            </div>
                          ) : (
                            <List
                              style={{
                                height: Math.min(520, Math.max(220, tracks.length * 58)),
                                width: "100%",
                              }}
                              rowCount={tracks.length}
                              rowHeight={58}
                              rowComponent={TrackRow}
                              rowProps={trackRowData}
                            />
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
});
