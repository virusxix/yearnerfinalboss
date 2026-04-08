"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore, type Whisper } from "@/store/useEchoStore";

type Props = {
  deviceId: string | null;
  onReplay: (trackUri: string, positionMs: number) => void;
};

type GroupMode = "person" | "song";

export const WhisperPanel = memo(function WhisperPanel({
  deviceId,
  onReplay,
}: Props) {
  const open = useEchoStore((s) => s.whisperPanelOpen);
  const setOpen = useEchoStore((s) => s.setWhisperPanelOpen);
  const whispers = useEchoStore((s) => s.whispers);
  const removeWhisper = useEchoStore((s) => s.removeWhisper);
  const [groupBy, setGroupBy] = useState<GroupMode>("person");

  const grouped = useMemo(() => {
    const map = new Map<string, Whisper[]>();
    for (const w of whispers) {
      const key = groupBy === "person" ? w.forWhom : w.songTitle;
      const arr = map.get(key) || [];
      arr.push(w);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [whispers, groupBy]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeWhisper(id);
    },
    [removeWhisper]
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close whispers"
            className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0c0812]/80 shadow-[-20px_0_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-8 py-6">
              <div>
                <h2 className="font-serif text-2xl text-white/95">Whispers</h2>
                <p className="mt-1 font-sans text-xs text-white/40">
                  Letters you never sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 font-sans text-xs text-white/60 transition-colors hover:text-white/90"
              >
                Close
              </button>
            </header>

            <div className="flex gap-2 border-b border-white/5 px-8 py-3">
              <button
                type="button"
                onClick={() => setGroupBy("person")}
                className={`rounded-full px-3 py-1 font-sans text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  groupBy === "person"
                    ? "border border-violet-300/30 bg-violet-400/10 text-white/80"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                By person
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("song")}
                className={`rounded-full px-3 py-1 font-sans text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  groupBy === "song"
                    ? "border border-violet-300/30 bg-violet-400/10 text-white/80"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                By song
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {whispers.length === 0 ? (
                <p className="font-serif text-lg text-white/30">
                  No whispers yet. Press the feather while a song plays to write
                  one.
                </p>
              ) : (
                <div className="space-y-8">
                  {grouped.map(([group, items]) => (
                    <div key={group}>
                      <p className="mb-3 font-sans text-[10px] uppercase tracking-[0.3em] text-violet-200/50">
                        {groupBy === "person" ? `To: ${group}` : group}
                      </p>
                      <ul className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {items.map((w, i) => (
                            <motion.li
                              key={w.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: 80, transition: { duration: 0.35 } }}
                              transition={{
                                delay: i * 0.04,
                                duration: 0.6,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <div className="group/whisper relative">
                                <button
                                  type="button"
                                  disabled={!deviceId}
                                  onClick={() => onReplay(w.trackUri, w.positionMs)}
                                  className="glass-panel w-full text-left transition-all duration-500 hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {w.lyricLine ? (
                                    <p className="mb-2 font-serif text-sm italic text-violet-200/40">
                                      &ldquo;{w.lyricLine}&rdquo;
                                    </p>
                                  ) : null}
                                  <p className="font-serif text-base leading-relaxed text-white/85">
                                    {w.note}
                                  </p>
                                  <p className="mt-3 font-sans text-[10px] text-white/35">
                                    {groupBy === "person"
                                      ? `${w.songTitle} · ${w.artist}`
                                      : `To: ${w.forWhom}`}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[9px] text-white/25">
                                    {new Date(w.createdAt).toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }
                                    )}{" "}
                                    · {Math.floor(w.positionMs / 1000)}s
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  aria-label="Delete whisper"
                                  onClick={(ev) => handleDelete(ev, w.id)}
                                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/40 opacity-0 backdrop-blur-md transition-all duration-300 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300/90 group-hover/whisper:opacity-100"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                    className="h-3 w-3"
                                  >
                                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                                  </svg>
                                </button>
                              </div>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
});
