"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore, type Whisper } from "@/store/useEchoStore";

type Props = {
  songId: string | null;
  currentPosMs: React.RefObject<number>;
  onSeekToWhisper: (trackUri: string, positionMs: number) => void;
};

const EDGE_SLOTS = [
  { x: "5%", y: "22%", align: "left" as const },
  { x: "74%", y: "16%", align: "right" as const },
  { x: "6%", y: "68%", align: "left" as const },
];

const APPEAR_DELAY_MS = 4000;
const ease = [0.22, 1, 0.36, 1] as const;

function prioritize(
  whispers: Whisper[],
  currentPosMs: number
): Whisper[] {
  const RANGE_MS = 30_000;
  return [...whispers].sort((a, b) => {
    const aInRange =
      Math.abs(a.positionMs - currentPosMs) < RANGE_MS ? 1 : 0;
    const bInRange =
      Math.abs(b.positionMs - currentPosMs) < RANGE_MS ? 1 : 0;
    if (aInRange !== bInRange) return bInRange - aInRange;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

type RecallCardProps = {
  whisper: Whisper;
  slot: (typeof EDGE_SLOTS)[number];
  index: number;
  isFirstVisit: boolean;
  onSeek: (trackUri: string, positionMs: number) => void;
  onOpenDetail: (w: Whisper) => void;
};

const RecallCard = memo(function RecallCard({
  whisper,
  slot,
  index,
  isFirstVisit,
  onSeek,
  onOpenDetail,
}: RecallCardProps) {
  const staggerDelay = APPEAR_DELAY_MS / 1000 + index * 2;

  return (
    <motion.div
      className="echo-recall-card pointer-events-auto absolute max-w-[220px] cursor-pointer"
      style={{
        left: slot.x,
        top: slot.y,
        textAlign: slot.align,
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 1.8,
        delay: staggerDelay,
        ease: [...ease],
      }}
      onClick={() => {
        onSeek(whisper.trackUri, whisper.positionMs);
        onOpenDetail(whisper);
      }}
      whileHover={{
        scale: 1.03,
        transition: { duration: 0.4 },
      }}
    >
      {/* Name appears first */}
      <motion.p
        className="font-sans text-[10px] uppercase tracking-[0.25em] text-violet-200/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: staggerDelay }}
      >
        For: {whisper.forWhom}
      </motion.p>

      {/* Note fades in after name */}
      <motion.p
        className="mt-1.5 font-serif text-sm leading-snug text-white/25"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: staggerDelay + 0.8 }}
      >
        {whisper.note.length > 70
          ? `${whisper.note.slice(0, 70)}…`
          : whisper.note}
      </motion.p>

      {/* Lyric snippet if present */}
      {whisper.lyricLine ? (
        <motion.p
          className="mt-1 font-serif text-[11px] italic text-violet-200/15"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: staggerDelay + 1.4 }}
        >
          &ldquo;{whisper.lyricLine.length > 40
            ? `${whisper.lyricLine.slice(0, 40)}…`
            : whisper.lyricLine}&rdquo;
        </motion.p>
      ) : null}

      {/* First-visit hint */}
      {isFirstVisit && index === 0 ? (
        <motion.p
          className="mt-3 font-sans text-[9px] tracking-wider text-white/15"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.5, 0] }}
          transition={{
            duration: 6,
            delay: staggerDelay + 2,
            ease: "easeInOut",
          }}
        >
          You&rsquo;ve been here before.
        </motion.p>
      ) : null}
    </motion.div>
  );
});

export const EchoRecall = memo(function EchoRecall({
  songId,
  currentPosMs,
  onSeekToWhisper,
}: Props) {
  const whispers = useEchoStore((s) => s.whispers);
  const openWhisperPanel = useEchoStore((s) => s.setWhisperPanelOpen);
  const [visible, setVisible] = useState(false);
  const [detailWhisper, setDetailWhisper] = useState<Whisper | null>(null);
  const seenSongs = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const songWhispers = useMemo(() => {
    if (!songId) return [];
    return whispers.filter((w) => w.songId === songId);
  }, [whispers, songId]);

  const ranked = useMemo(() => {
    const pos = currentPosMs.current ?? 0;
    return prioritize(songWhispers, pos).slice(0, 3);
  }, [songWhispers, currentPosMs]);

  const isFirstVisit = useMemo(() => {
    if (!songId) return false;
    return !seenSongs.current.has(songId);
  }, [songId]);

  useEffect(() => {
    setVisible(false);
    setDetailWhisper(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!songId || ranked.length === 0) return;

    timerRef.current = setTimeout(() => {
      setVisible(true);
      if (songId) seenSongs.current.add(songId);
    }, APPEAR_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [songId, ranked.length]);

  const onOpenDetail = useCallback((w: Whisper) => {
    setDetailWhisper(w);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailWhisper(null);
  }, []);

  if (ranked.length === 0) return null;

  return (
    <>
      {/* Ghost-mode floating recalls */}
      <div className="pointer-events-none fixed inset-0 z-[18]">
        <AnimatePresence>
          {visible
            ? ranked.map((w, i) => (
                <RecallCard
                  key={w.id}
                  whisper={w}
                  slot={EDGE_SLOTS[i % EDGE_SLOTS.length]}
                  index={i}
                  isFirstVisit={isFirstVisit}
                  onSeek={onSeekToWhisper}
                  onOpenDetail={onOpenDetail}
                />
              ))
            : null}
        </AnimatePresence>
      </div>

      {/* Detail modal when a recall is clicked */}
      <AnimatePresence>
        {detailWhisper ? (
          <>
            <motion.div
              className="fixed inset-0 z-[62] bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              onClick={closeDetail}
            />
            <motion.div
              className="fixed inset-0 z-[63] flex items-center justify-center px-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.5, ease: [...ease] }}
            >
              <div className="recall-detail relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0812]/85 px-8 py-8 shadow-[0_0_100px_rgba(160,140,220,0.12)] backdrop-blur-2xl md:px-10 md:py-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-violet-200/40">
                  A memory resurfaced
                </p>
                <h3 className="mt-3 font-serif text-2xl leading-snug text-white/90">
                  For: {detailWhisper.forWhom}
                </h3>

                {detailWhisper.lyricLine ? (
                  <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 font-serif text-sm italic leading-relaxed text-violet-200/40">
                    &ldquo;{detailWhisper.lyricLine}&rdquo;
                  </p>
                ) : null}

                <p className="mt-5 font-serif text-base leading-relaxed text-white/80">
                  {detailWhisper.note}
                </p>

                <div className="mt-5 flex items-center gap-3 font-sans text-[10px] text-white/30">
                  <span>{detailWhisper.songTitle}</span>
                  <span>·</span>
                  <span>{detailWhisper.artist}</span>
                  <span>·</span>
                  <span>
                    {new Date(detailWhisper.createdAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      openWhisperPanel(true);
                      closeDetail();
                    }}
                    className="rounded-full border border-violet-300/20 bg-violet-400/10 px-6 py-2 font-sans text-[10px] uppercase tracking-widest text-white/70 transition-all duration-500 hover:bg-violet-400/20"
                  >
                    View all whispers
                  </button>
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="font-sans text-[10px] text-white/35 transition-colors hover:text-white/60"
                  >
                    Let it fade
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
});
