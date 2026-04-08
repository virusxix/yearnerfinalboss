"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore, type LyricMode } from "@/store/useEchoStore";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
  lineIdx: number;
  text: string | null;
  onCapture: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

function LyricModeToggle() {
  const mode = useEchoStore((s) => s.lyricMode);
  const setMode = useEchoStore((s) => s.setLyricMode);
  const modes: { key: LyricMode; label: string }[] = [
    { key: "dual", label: "Dual" },
    { key: "original", label: "Original" },
    { key: "translated", label: "English" },
  ];

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      {modes.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMode(m.key)}
          className={`rounded-full px-3 py-1 font-sans text-[9px] uppercase tracking-widest transition-all duration-300 ${
            mode === m.key
              ? "border border-violet-300/25 bg-violet-400/10 text-white/70"
              : "text-white/25 hover:text-white/50"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export const DualLyric = memo(function DualLyric({
  lineIdx,
  text,
  onCapture,
}: Props) {
  const mode = useEchoStore((s) => s.lyricMode);
  const { translation, loading } = useTranslation(text);

  const isForeign = translation ? !translation.isEnglish : false;
  const englishText =
    isForeign && translation?.translated ? translation.translated : null;

  return (
    <div className="min-h-[10rem] w-full max-w-2xl text-center">
      <AnimatePresence mode="wait">
        {text ? (
          <motion.div
            key={`${lineIdx}-${text}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.85, ease: [...ease] }}
          >
            {mode === "dual" ? (
              <>
                {/* Original line (always shown in dual) */}
                <motion.button
                  type="button"
                  onClick={onCapture}
                  className="lyric-glow w-full cursor-pointer bg-transparent font-serif text-2xl leading-relaxed text-white/92 md:text-4xl md:leading-snug"
                >
                  {text}
                </motion.button>

                {/* English translation — only for non-English songs */}
                {isForeign && englishText ? (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.7,
                      delay: 0.2,
                      ease: [...ease],
                    }}
                    className="mt-3 font-sans text-base leading-relaxed text-white/45 md:text-lg"
                  >
                    {englishText}
                  </motion.p>
                ) : isForeign && loading ? (
                  <p className="mt-3 font-sans text-sm text-white/20">…</p>
                ) : null}
              </>
            ) : null}

            {mode === "original" ? (
              <motion.button
                type="button"
                onClick={onCapture}
                className="lyric-glow w-full cursor-pointer bg-transparent font-serif text-2xl leading-relaxed text-white/92 md:text-4xl md:leading-snug"
              >
                {text}
              </motion.button>
            ) : null}

            {mode === "translated" ? (
              <motion.button
                type="button"
                onClick={onCapture}
                className="lyric-glow w-full cursor-pointer bg-transparent font-serif text-2xl leading-relaxed text-white/92 md:text-4xl md:leading-snug"
              >
                {isForeign && englishText ? englishText : text}
              </motion.button>
            ) : null}
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            className="font-serif text-xl text-white/40"
          >
            …
          </motion.p>
        )}
      </AnimatePresence>

      <LyricModeToggle />

      <p className="mt-4 font-sans text-[10px] text-white/25">
        Tap the line to save to your notes
      </p>
    </div>
  );
});
