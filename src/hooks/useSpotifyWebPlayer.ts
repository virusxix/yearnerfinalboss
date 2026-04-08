"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NormalizedTrack = {
  id: string;
  uri: string;
  name: string;
  artists: string;
  image: string | null;
  durationMs: number;
};

export type PlaybackContext = {
  uri: string;
  type: string;
} | null;

export type PlayerSnapshot = {
  track: NormalizedTrack | null;
  positionMs: number;
  isPlaying: boolean;
  context: PlaybackContext;
};

type SdkAlbumImage = { url: string };
type SdkTrack = {
  id: string;
  uri: string;
  name: string;
  duration_ms?: number;
  artists?: { name: string }[];
  album?: { images?: SdkAlbumImage[] };
};

type SdkPlayerState = {
  paused: boolean;
  position?: number;
  track_window?: { current_track?: SdkTrack | null };
  context?: { uri?: string; metadata?: { type?: string } };
};

type SpotifyPlayerHandle = {
  connect(): Promise<boolean> | void;
  disconnect(): void;
  addListener(event: string, cb: (payload: unknown) => void): boolean | void;
  togglePlay(): void;
  nextTrack(): void;
  previousTrack(): void;
  seek(position_ms: number): void;
  setVolume(value: number): Promise<void> | void;
  getVolume(): Promise<number>;
};

type SpotifyConstructor = new (options: {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}) => SpotifyPlayerHandle;

type SpotifyWindow = Window & {
  Spotify?: { Player: SpotifyConstructor };
  onSpotifyWebPlaybackSDKReady?: () => void;
};

async function fetchAccessToken(): Promise<string | null> {
  const r = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token?: string };
  return j.access_token ?? null;
}

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as SpotifyWindow;
  if (w.Spotify) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.getElementById("spotify-web-playback-sdk");
    if (existing) {
      const timer = window.setInterval(() => {
        if (w.Spotify) {
          window.clearInterval(timer);
          resolve();
        }
      }, 40);
      return;
    }
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement("script");
    s.id = "spotify-web-playback-sdk";
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.async = true;
    document.body.appendChild(s);
  });
}

function mapState(state: SdkPlayerState | null): PlayerSnapshot {
  if (!state?.track_window?.current_track) {
    return { track: null, positionMs: 0, isPlaying: false, context: null };
  }
  const t = state.track_window.current_track;
  const img =
    t.album?.images?.[0]?.url ??
    t.album?.images?.[1]?.url ??
    null;
  const ctxUri = state.context?.uri;
  return {
    track: {
      id: t.id,
      uri: t.uri,
      name: t.name,
      artists: (t.artists || []).map((a) => a.name).join(", "),
      image: img,
      durationMs: t.duration_ms ?? 0,
    },
    positionMs: state.position ?? 0,
    isPlaying: !state.paused,
    context: ctxUri ? { uri: ctxUri, type: state.context?.metadata?.type ?? "playlist" } : null,
  };
}

export function useSpotifyWebPlayer() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>({
    track: null,
    positionMs: 0,
    isPlaying: false,
    context: null,
  });
  const playerRef = useRef<SpotifyPlayerHandle | null>(null);
  const lastSnapshotRef = useRef<PlayerSnapshot>({
    track: null,
    positionMs: 0,
    isPlaying: false,
    context: null,
  });
  const lastSnapshotAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = await fetchAccessToken();
      if (!token || cancelled) return;
      await loadSdk();
      if (cancelled) return;
      const w = window as SpotifyWindow;
      const Spotify = w.Spotify;
      if (!Spotify) {
        setSdkError("SDK unavailable");
        return;
      }

      const player = new Spotify.Player({
        name: "Echo & Haze",
        getOAuthToken: (cb) => {
          void fetchAccessToken().then((t) => {
            if (t) cb(t);
          });
        },
        volume: 0.9,
      });

      player.addListener("ready", (payload) => {
        const { device_id } = payload as { device_id: string };
        setDeviceId(device_id);
        setReady(true);
        void fetch("/api/spotify/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transfer",
            device_id,
            play: false,
          }),
        });
      });

      player.addListener("not_ready", () => {
        setReady(false);
        setDeviceId(null);
      });

      player.addListener("initialization_error", (payload) => {
        const { message } = payload as { message: string };
        setSdkError(message);
      });

      player.addListener("authentication_error", (payload) => {
        const { message } = payload as { message: string };
        setSdkError(message);
      });

      player.addListener("playback_error", (payload) => {
        const { message } = payload as { message: string };
        setSdkError(message);
      });

      player.addListener("player_state_changed", (payload) => {
        const nextSnapshot = mapState(payload as SdkPlayerState);
        const prevSnapshot = lastSnapshotRef.current;
        const now = Date.now();
        const sameTrack = prevSnapshot.track?.id === nextSnapshot.track?.id;
        const changed =
          !sameTrack ||
          prevSnapshot.isPlaying !== nextSnapshot.isPlaying ||
          Math.abs(prevSnapshot.positionMs - nextSnapshot.positionMs) > 950;
        if (changed || now - lastSnapshotAtRef.current > 1000) {
          lastSnapshotRef.current = nextSnapshot;
          lastSnapshotAtRef.current = now;
          setSnapshot(nextSnapshot);
        }
      });

      try {
        const result = player.connect();
        if (result instanceof Promise) {
          const connected = await result;
          if (!connected) setSdkError("Could not connect player");
        }
      } catch {
        setSdkError("Could not connect player");
      }
      playerRef.current = player;
    }

    void run();
    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const next = useCallback(() => {
    playerRef.current?.nextTrack();
  }, []);

  const prev = useCallback(() => {
    playerRef.current?.previousTrack();
  }, []);

  const seek = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
  }, []);

  const [volume, setVolumeState] = useState(0.9);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    playerRef.current?.setVolume(clamped);
  }, []);

  return {
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
  };
}
