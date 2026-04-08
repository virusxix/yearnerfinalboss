"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore, type JournalEntry, type Whisper } from "@/store/useEchoStore";

type Props = {
  songId: string | null;
  currentPosMs: React.RefObject<number>;
  onSeek: (trackUri: string, positionMs: number) => void;
};

const SLOTS = [
  { x: "78%", y: "24%", align: "right" as const },
  { x: "5%", y: "38%", align: "left" as const },
  { x: "76%", y: "72%", align: "right" as const },
];

const APPEAR_DELAY_MS = 0;
const ease = [0.22, 1, 0.36, 1] as const;

function extractTrackId(uri: string): string | null {
  const parts = uri.split(":");
  return parts.length >= 3 ? parts[2] : null;
}

function whisperToEntry(w: Whisper): JournalEntry {
  return {
    id: w.id,
    songTitle: w.songTitle,
    artist: w.artist,
    lyricLine: w.lyricLine || w.note,
    positionMs: w.positionMs,
    trackUri: w.trackUri,
    capturedAt: w.createdAt,
    forWhom: w.forWhom,
    feeling: w.note,
  };
}

function rank(entries: JournalEntry[], currentPosMs: number): JournalEntry[] {
  return [...entries].sort((a, b) => {
    const aHasExtra = a.forWhom || a.feeling ? 1 : 0;
    const bHasExtra = b.forWhom || b.feeling ? 1 : 0;
    if (aHasExtra !== bHasExtra) return bHasExtra - aHasExtra;

    const RANGE = 30_000;
    const aClose = Math.abs(a.positionMs - currentPosMs) < RANGE ? 1 : 0;
    const bClose = Math.abs(b.positionMs - currentPosMs) < RANGE ? 1 : 0;
    if (aClose !== bClose) return bClose - aClose;

    return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
  });
}

const RecallCard = memo(function RecallCard({
  entry,
  slot,
  index,
}: {
  entry: JournalEntry;
  slot: (typeof SLOTS)[number];
  index: number;
}) {
  const delay = APPEAR_DELAY_MS / 1000 + index * 2.2;

  return (
    <motion.div
      className="pointer-events-auto absolute max-w-[240px] cursor-default"
      style={{ left: slot.x, top: slot.y, textAlign: slot.align }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 1.8, delay, ease: [...ease] }}
    >
      <motion.p
        className="font-serif text-sm italic leading-snug text-white/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay }}
      >
        &ldquo;{entry.lyricLine.length > 50
          ? `${entry.lyricLine.slice(0, 50)}…`
          : entry.lyricLine}&rdquo;
      </motion.p>

      {entry.forWhom ? (
        <motion.p
          className="mt-1.5 font-sans text-[11px] uppercase tracking-[0.25em] text-violet-200/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: delay + 0.6 }}
        >
          For: {entry.forWhom}
        </motion.p>
      ) : null}

      {entry.feeling ? (
        <motion.p
          className="mt-1 font-serif text-sm leading-snug text-white/18"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: delay + 1 }}
        >
          {entry.feeling.length > 60
            ? `${entry.feeling.slice(0, 60)}…`
            : entry.feeling}
        </motion.p>
      ) : null}
    </motion.div>
  );
});

export const NoteRecall = memo(function NoteRecall({
  songId,
  currentPosMs,
}: Props) {
  const entries = useEchoStore((s) => s.entries);
  const whispers = useEchoStore((s) => s.whispers);
  const [visible, setVisible] = useState(false);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const songEntries = useMemo(() => {
    if (!songId) return [];
    const fromEntries = entries.filter((e) => extractTrackId(e.trackUri) === songId);
    const fromWhispers = whispers
      .filter((w) => w.songId === songId || extractTrackId(w.trackUri) === songId)
      .map(whisperToEntry);
    const seenIds = new Set(fromEntries.map((e) => e.id));
    return [...fromEntries, ...fromWhispers.filter((w) => !seenIds.has(w.id))];
  }, [entries, whispers, songId]);

  const ranked = useMemo(() => {
    const pos = currentPosMs.current ?? 0;
    return rank(songEntries, pos).slice(0, 3);
  }, [songEntries, currentPosMs]);

  useEffect(() => {
    setVisible(false);
    setDetailEntry(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!songId || ranked.length === 0) return;

    timerRef.current = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [songId, ranked.length]);

  const openDetail = useCallback((e: JournalEntry) => setDetailEntry(e), []);
  const closeDetail = useCallback(() => setDetailEntry(null), []);
  const openJournal = useEchoStore((s) => s.setJournalOpen);

  if (ranked.length === 0) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[17]">
        <AnimatePresence>
          {visible
            ? ranked.map((e, i) => (
                <div
                  key={e.id}
                  onClick={() => openDetail(e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === "Enter" && openDetail(e)}
                >
                  <RecallCard
                    entry={e}
                    slot={SLOTS[i % SLOTS.length]}
                    index={i}
                  />
                </div>
              ))
            : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {detailEntry ? (
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
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0812]/85 px-8 py-8 shadow-[0_0_100px_rgba(160,140,220,0.12)] backdrop-blur-2xl md:px-10 md:py-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-violet-200/40">
                  A note from before
                </p>

                <p className="mt-4 whitespace-pre-line rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 font-serif text-base italic leading-relaxed text-white/60">
                  &ldquo;{detailEntry.lyricLine}&rdquo;
                </p>

                {detailEntry.forWhom ? (
                  <p className="mt-4 font-sans text-xs text-violet-200/50">
                    For <span className="text-violet-200/70">{detailEntry.forWhom}</span>
                  </p>
                ) : null}

                {detailEntry.feeling ? (
                  <p className="mt-3 font-serif text-base leading-relaxed text-white/75">
                    {detailEntry.feeling}
                  </p>
                ) : null}

                <div className="mt-5 flex items-center gap-3 font-sans text-[10px] text-white/30">
                  <span>{detailEntry.songTitle}</span>
                  <span>·</span>
                  <span>{detailEntry.artist}</span>
                  <span>·</span>
                  <span>
                    {new Date(detailEntry.capturedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                  {detailEntry.weather ? (
                    <>
                      <span>·</span>
                      <span>{detailEntry.weather}</span>
                    </>
                  ) : null}
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      openJournal(true);
                      closeDetail();
                    }}
                    className="rounded-full border border-violet-300/20 bg-violet-400/10 px-6 py-2 font-sans text-[10px] uppercase tracking-widest text-white/70 transition-all duration-500 hover:bg-violet-400/20"
                  >
                    View all notes
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
