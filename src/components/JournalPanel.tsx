"use client";

import { memo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore, type JournalEntry } from "@/store/useEchoStore";

type Props = {
  deviceId: string | null;
  onReplay: (entry: JournalEntry) => void;
};

export const JournalPanel = memo(function JournalPanel({ deviceId, onReplay }: Props) {
  const { journalOpen, setJournalOpen, entries } = useEchoStore();
  const removeEntry = useEchoStore((s) => s.removeEntry);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeEntry(id);
    },
    [removeEntry]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setJournalOpen(true)}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-sans text-xs uppercase tracking-widest text-white/70 backdrop-blur-md transition-all duration-500 hover:border-white/30 hover:text-white/90"
      >
        Notes
      </button>

      <AnimatePresence>
        {journalOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close notes"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              onClick={() => setJournalOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="journal-title"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0c0812]/75 shadow-[-20px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            >
              <header className="flex items-center justify-between border-b border-white/10 px-8 py-6">
                <div>
                  <h2
                    id="journal-title"
                    className="font-serif text-2xl text-white/95"
                  >
                    Notes
                  </h2>
                  <p className="mt-1 font-sans text-xs text-white/45">
                    Moments caught in glass.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setJournalOpen(false)}
                  className="rounded-full border border-white/15 px-3 py-1 font-sans text-xs text-white/60 transition-colors hover:text-white/90"
                >
                  Close
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {entries.length === 0 ? (
                  <p className="font-serif text-lg text-white/35">
                    Nothing saved yet. Tap the lyric to capture this instant.
                  </p>
                ) : (
                  <ul className="space-y-5">
                    <AnimatePresence mode="popLayout">
                      {entries.map((e, i) => (
                        <motion.li
                          key={e.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 80, transition: { duration: 0.35 } }}
                          transition={{
                            delay: i * 0.04,
                            duration: 0.7,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <div className="group/note relative">
                            <button
                              type="button"
                              disabled={!deviceId}
                              onClick={() => onReplay(e)}
                              className="glass-panel w-full text-left transition-all duration-500 hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <p className="font-serif text-lg leading-snug text-white/90">
                                &ldquo;{e.lyricLine}&rdquo;
                              </p>
                              {e.forWhom ? (
                                <p className="mt-2 font-sans text-xs text-violet-200/50">
                                  For <span className="text-violet-200/70">{e.forWhom}</span>
                                </p>
                              ) : null}
                              {e.feeling ? (
                                <p className="mt-1.5 font-serif text-sm italic leading-relaxed text-white/50">
                                  {e.feeling}
                                </p>
                              ) : null}
                              <p className="mt-3 font-sans text-xs text-white/45">
                                {e.songTitle} · {e.artist}
                              </p>
                              <p className="mt-1 font-mono text-[10px] text-white/35">
                                {new Date(e.capturedAt).toLocaleString()} ·{" "}
                                {Math.floor(e.positionMs / 1000)}s
                                {e.weather ? ` · ${e.weather}` : ""}
                              </p>
                              {deviceId ? (
                                <p className="mt-2 font-sans text-[10px] uppercase tracking-widest text-violet-200/50">
                                  Replay here
                                </p>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              aria-label="Delete note"
                              onClick={(ev) => handleDelete(ev, e.id)}
                              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/40 opacity-0 backdrop-blur-md transition-all duration-300 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300/90 group-hover/note:opacity-100"
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
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
});
