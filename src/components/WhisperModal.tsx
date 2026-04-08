"use client";

import { memo, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore } from "@/store/useEchoStore";

type Props = {
  songId: string;
  songTitle: string;
  artist: string;
  trackUri: string;
  positionMs: number;
  currentLyric: string | null;
};

export const WhisperModal = memo(function WhisperModal({
  songId,
  songTitle,
  artist,
  trackUri,
  positionMs,
  currentLyric,
}: Props) {
  const open = useEchoStore((s) => s.whisperModalOpen);
  const close = useEchoStore((s) => s.setWhisperModalOpen);
  const addWhisper = useEchoStore((s) => s.addWhisper);

  const [forWhom, setForWhom] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSaved(false);
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      setForWhom("");
      setNote("");
    }
  }, [open]);

  const save = () => {
    if (!forWhom.trim() || !note.trim()) return;
    addWhisper({
      songId,
      songTitle,
      artist,
      trackUri,
      forWhom: forWhom.trim(),
      note: note.trim(),
      lyricLine: currentLyric || undefined,
      positionMs,
      createdAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => close(false), 1800);
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => close(false)}
          />
          <motion.div
            className="fixed inset-0 z-[61] flex items-center justify-center px-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="whisper-modal relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0c0812]/80 shadow-[0_0_120px_rgba(160,140,220,0.15)] backdrop-blur-2xl">
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center px-10 py-16 text-center"
                  >
                    <motion.div
                      className="whisper-save-glow mb-6 h-16 w-16 rounded-full border border-violet-300/20 bg-violet-400/10"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.6, ease: "easeInOut" }}
                    />
                    <p className="font-serif text-xl text-white/80">
                      Some things are better left unsent.
                    </p>
                    <p className="mt-3 font-sans text-xs text-white/35">
                      Your whisper has been saved.
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
                      A whisper for
                    </p>
                    <h2 className="mt-2 font-serif text-2xl text-white/90">
                      An unspoken thought
                    </h2>

                    {currentLyric ? (
                      <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 font-serif text-sm leading-relaxed text-white/50">
                        &ldquo;{currentLyric}&rdquo;
                      </p>
                    ) : null}

                    <div className="mt-6 space-y-5">
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
                          className="whisper-input w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-serif text-lg text-white/90 placeholder-white/25 outline-none transition-all duration-500 focus:border-violet-300/30 focus:bg-white/[0.05]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block font-sans text-[10px] uppercase tracking-widest text-white/40">
                          What do you feel?
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Write what you cannot say…"
                          rows={4}
                          className="whisper-input w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-serif text-base leading-relaxed text-white/90 placeholder-white/25 outline-none transition-all duration-500 focus:border-violet-300/30 focus:bg-white/[0.05]"
                        />
                      </div>
                    </div>

                    <p className="mt-3 font-sans text-[10px] text-white/25">
                      {songTitle} · {artist}
                    </p>

                    <div className="mt-6 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={save}
                        disabled={!forWhom.trim() || !note.trim()}
                        className="rounded-full border border-violet-300/20 bg-violet-400/10 px-8 py-2.5 font-sans text-xs uppercase tracking-widest text-white/85 transition-all duration-500 hover:border-violet-300/40 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Let it linger
                      </button>
                      <button
                        type="button"
                        onClick={() => close(false)}
                        className="font-sans text-xs text-white/40 transition-colors hover:text-white/70"
                      >
                        Nevermind
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
