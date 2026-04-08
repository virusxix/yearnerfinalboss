"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type LyricCaptureContext = {
  line: string;
  prevLine: string | null;
  nextLine: string | null;
};

export type PendingCapture = {
  lyricLine: string;
  /** Optional lines above / below the tapped line (notes modal can include or omit) */
  adjacentPrevLine?: string | null;
  adjacentNextLine?: string | null;
  songTitle: string;
  artist: string;
  trackUri: string;
  positionMs: number;
  weather?: string;
};

function buildSavedLyric(
  pending: PendingCapture,
  includePrev: boolean,
  includeNext: boolean
): string {
  const parts: string[] = [];
  const prev = pending.adjacentPrevLine?.trim();
  const next = pending.adjacentNextLine?.trim();
  if (includePrev && prev) parts.push(prev);
  parts.push(pending.lyricLine.trim());
  if (includeNext && next) parts.push(next);
  return parts.join("\n");
}

type Props = {
  pending: PendingCapture | null;
  onSave: (data: PendingCapture & { forWhom?: string; feeling?: string }) => void;
  onClose: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

export const CaptureModal = memo(function CaptureModal({
  pending,
  onSave,
  onClose,
}: Props) {
  const [forWhom, setForWhom] = useState("");
  const [feeling, setFeeling] = useState("");
  const [includePrev, setIncludePrev] = useState(false);
  const [includeNext, setIncludeNext] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPrev = Boolean(pending?.adjacentPrevLine?.trim());
  const hasNext = Boolean(pending?.adjacentNextLine?.trim());
  const previewLyric = pending
    ? buildSavedLyric(pending, includePrev, includeNext)
    : "";

  useEffect(() => {
    if (pending) {
      setForWhom("");
      setFeeling("");
      setIncludePrev(false);
      setIncludeNext(false);
      setSaved(false);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [pending]);

  const save = useCallback(() => {
    if (!pending) return;
    const lyricLine = buildSavedLyric(pending, includePrev, includeNext);
    onSave({
      ...pending,
      lyricLine,
      forWhom: forWhom.trim() || undefined,
      feeling: feeling.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => onClose(), 1400);
  }, [
    pending,
    includePrev,
    includeNext,
    forWhom,
    feeling,
    onSave,
    onClose,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
    },
    [save]
  );

  return (
    <AnimatePresence>
      {pending ? (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[61] flex items-center justify-center px-4"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.6, ease: [...ease] }}
          >
            <div
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0c0812]/80 shadow-[0_0_120px_rgba(160,140,220,0.15)] backdrop-blur-2xl"
              onKeyDown={handleKeyDown}
            >
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center px-10 py-14 text-center"
                  >
                    <motion.div
                      className="mb-5 h-14 w-14 rounded-full border border-violet-300/20 bg-violet-400/10"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 1, 0.6],
                      }}
                      transition={{ duration: 1.4, ease: "easeInOut" }}
                    />
                    <p className="font-serif text-xl text-white/80">
                      Moment captured.
                    </p>
                    <p className="mt-2 font-sans text-xs text-white/35">
                      Saved to your notes.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-8 py-8 md:px-10 md:py-10"
                  >
                    <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/35">
                      Capture this moment
                    </p>

                    <p className="mt-4 whitespace-pre-line rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 font-serif text-base leading-relaxed text-white/70">
                      &ldquo;{previewLyric}&rdquo;
                    </p>

                    {(hasPrev || hasNext) && (
                      <div className="mt-4 space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <p className="font-sans text-[10px] uppercase tracking-widest text-white/35">
                          Surrounding lines
                        </p>
                        <label
                          className={`flex cursor-pointer items-start gap-3 ${
                            hasPrev ? "" : "pointer-events-none opacity-35"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={includePrev && hasPrev}
                            disabled={!hasPrev}
                            onChange={(e) => setIncludePrev(e.target.checked)}
                            className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-white/5 text-violet-400 focus:ring-violet-400/40"
                          />
                          <span className="text-left font-sans text-xs leading-snug text-white/55">
                            Include the line above
                            {hasPrev ? (
                              <span className="mt-1 block font-serif text-[13px] italic text-white/40">
                                {pending.adjacentPrevLine}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-white/30">
                                (none)
                              </span>
                            )}
                          </span>
                        </label>
                        <label
                          className={`flex cursor-pointer items-start gap-3 ${
                            hasNext ? "" : "pointer-events-none opacity-35"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={includeNext && hasNext}
                            disabled={!hasNext}
                            onChange={(e) => setIncludeNext(e.target.checked)}
                            className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-white/5 text-violet-400 focus:ring-violet-400/40"
                          />
                          <span className="text-left font-sans text-xs leading-snug text-white/55">
                            Include the line below
                            {hasNext ? (
                              <span className="mt-1 block font-serif text-[13px] italic text-white/40">
                                {pending.adjacentNextLine}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-white/30">
                                (none)
                              </span>
                            )}
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="mt-6 space-y-4">
                      <div>
                        <label className="mb-1.5 block font-sans text-[10px] uppercase tracking-widest text-white/40">
                          For whom?
                        </label>
                        <input
                          ref={inputRef}
                          type="text"
                          value={forWhom}
                          onChange={(e) => setForWhom(e.target.value)}
                          placeholder="A name, a memory…"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-serif text-base text-white/90 placeholder-white/25 outline-none transition-all duration-500 focus:border-violet-300/30 focus:bg-white/[0.05]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-sans text-[10px] uppercase tracking-widest text-white/40">
                          What do you feel?
                        </label>
                        <textarea
                          value={feeling}
                          onChange={(e) => setFeeling(e.target.value)}
                          placeholder="Write what you cannot say…"
                          rows={3}
                          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 font-serif text-base leading-relaxed text-white/90 placeholder-white/25 outline-none transition-all duration-500 focus:border-violet-300/30 focus:bg-white/[0.05]"
                        />
                      </div>
                    </div>

                    <p className="mt-3 font-sans text-[10px] text-white/25">
                      {pending.songTitle} · {pending.artist}
                    </p>

                    <div className="mt-6 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={save}
                        className="rounded-full border border-violet-300/20 bg-violet-400/10 px-8 py-2.5 font-sans text-xs uppercase tracking-widest text-white/85 transition-all duration-500 hover:border-violet-300/40 hover:bg-violet-400/20"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="font-sans text-xs text-white/40 transition-colors hover:text-white/70"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
});
