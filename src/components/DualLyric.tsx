"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { useEchoStore, type LyricMode } from "@/store/useEchoStore";
import { usePrefetchTranslation, useTranslation } from "@/hooks/useTranslation";
import type { LyricCaptureContext } from "@/components/CaptureModal";

type Props = {
  lineIdx: number;
  prevText: string | null;
  text: string | null;
  nextText: string | null;
  /** Line after next — feeds the cylinder so upcoming text is already in the strip */
  afterNextText: string | null;
  onCapture: (ctx: LyricCaptureContext) => void;
  trackId?: string | null;
  reducedMotion?: boolean;
};

/** Four stacked lines: prev → cur → next → afterNext (viewport shows top three; fourth scrolls in) */
type CylinderSnap = {
  prev: string | null;
  cur: string;
  next: string | null;
  afterNext: string | null;
  lineIdx: number;
};

const easeIO = [0.42, 0, 0.58, 1] as const;

const ROW_H = "h-14 shrink-0 md:h-16";
const VIEWPORT_H = "h-[10.5rem] md:h-48";

function LyricModeToggle() {
  const mode = useEchoStore((s) => s.lyricMode);
  const setMode = useEchoStore((s) => s.setLyricMode);
  const modes: { key: LyricMode; label: string }[] = [
    { key: "dual", label: "Dual" },
    { key: "original", label: "Original" },
    { key: "translated", label: "English" },
  ];

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
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
  prevText,
  text,
  nextText,
  afterNextText,
  onCapture,
  trackId = null,
  reducedMotion = false,
}: Props) {
  const mode = useEchoStore((s) => s.lyricMode);
  const [display, setDisplay] = useState<CylinderSnap | null>(null);
  const trackKeyRef = useRef<string>("");
  const rowRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({
    prevText,
    text,
    nextText,
    afterNextText,
    lineIdx,
  });
  propsRef.current = {
    prevText,
    text,
    nextText,
    afterNextText,
    lineIdx,
  };
  const controls = useAnimation();

  const { translation, loading } = useTranslation(display?.cur ?? null);
  const isForeign = translation ? !translation.isEnglish : false;
  const englishText =
    isForeign && translation?.translated ? translation.translated : null;

  usePrefetchTranslation(mode === "dual" ? text : null);
  usePrefetchTranslation(mode === "dual" ? prevText : null);
  usePrefetchTranslation(mode === "dual" ? nextText : null);
  usePrefetchTranslation(mode === "dual" ? afterNextText : null);

  const motionReduced = reducedMotion;

  const lineTypography =
    "lyric-context-line w-full max-w-[min(100%,26rem)] px-2 text-center font-serif text-lg font-normal leading-tight md:max-w-xl md:text-2xl md:leading-tight";

  const contextRowClass = `${lineTypography} text-white/45 md:text-white/50 ${
    motionReduced ? "" : "blur-[0.85px] md:blur-[1px]"
  }`;

  const breatheWrap = !motionReduced
    ? "lyric-cinematic-breathe inline-flex w-full max-w-[min(100%,26rem)] justify-center md:max-w-xl"
    : "inline-flex w-full max-w-[min(100%,26rem)] justify-center md:max-w-xl";

  const glowClass = motionReduced
    ? "lyric-glow lyric-glow-interactive"
    : "lyric-glow lyric-glow-interactive lyric-cinematic-glow-pulse";

  const currentBtnClass = `${glowClass} ${lineTypography} cursor-pointer rounded-lg bg-transparent py-0.5 text-white transition-[transform] duration-300 hover:scale-[1.01] active:scale-[0.995]`;

  const stripLabel =
    mode === "translated" && isForeign && englishText ? englishText : display?.cur ?? "";

  const snapFromProps = (): CylinderSnap => ({
    prev: prevText,
    cur: text!,
    next: nextText,
    afterNext: afterNextText,
    lineIdx,
  });

  useEffect(() => {
    if (!text) {
      setDisplay(null);
      void controls.start({ y: 0, transition: { duration: 0 } });
      return;
    }

    const tk = trackId ?? "";
    if (trackKeyRef.current !== tk) {
      trackKeyRef.current = tk;
      setDisplay(snapFromProps());
      void controls.start({ y: 0, transition: { duration: 0 } });
      return;
    }

    setDisplay((d) => {
      if (!d) return snapFromProps();
      if (d.lineIdx === lineIdx) {
        return {
          prev: prevText,
          cur: text,
          next: nextText,
          afterNext: afterNextText,
          lineIdx,
        };
      }
      return d;
    });
  }, [lineIdx, prevText, text, nextText, afterNextText, trackId]);

  useEffect(() => {
    if (!text || !display) return;
    if (display.lineIdx === lineIdx) return;

    const forward = lineIdx > display.lineIdx;

    if (motionReduced || !forward) {
      setDisplay({
        prev: prevText,
        cur: text,
        next: nextText,
        afterNext: afterNextText,
        lineIdx,
      });
      void controls.start({ y: 0, transition: { duration: 0 } });
      return;
    }

    let cancelled = false;
    const step = rowRef.current?.offsetHeight ?? 56;

    void (async () => {
      await controls.start({
        y: -step,
        transition: { duration: 0.78, ease: easeIO },
      });
      if (cancelled) return;
      const p = propsRef.current;
      if (!p.text) return;
      setDisplay({
        prev: p.prevText,
        cur: p.text,
        next: p.nextText,
        afterNext: p.afterNextText,
        lineIdx: p.lineIdx,
      });
      await controls.start({ y: 0, transition: { duration: 0 } });
    })();

    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [
    lineIdx,
    display,
    text,
    motionReduced,
    controls,
    prevText,
    nextText,
    afterNextText,
  ]);

  const placeholderRow = (
    <p
      className={`${contextRowClass} min-h-[1.25em] select-none text-transparent blur-none`}
      aria-hidden
    >
      &nbsp;
    </p>
  );

  const contextLine = (value: string | null) =>
    value ? <p className={contextRowClass}>{value}</p> : placeholderRow;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center text-center">
      {text && display ? (
        <div className="flex w-full flex-col items-center">
          <div
            className={`w-full overflow-hidden md:max-w-xl ${VIEWPORT_H}`}
          >
            <motion.div
              animate={controls}
              className="flex flex-col"
              style={{ willChange: "transform" }}
            >
              <div
                ref={rowRef}
                className={`flex w-full items-center justify-center overflow-hidden ${ROW_H}`}
              >
                {contextLine(display.prev)}
              </div>
              <div
                className={`flex w-full items-center justify-center overflow-hidden ${ROW_H}`}
              >
                <div className={breatheWrap}>
                  <motion.button
                    type="button"
                    onClick={() =>
                      onCapture({
                        line: display.cur,
                        prevLine: display.prev,
                        nextLine: display.next,
                      })
                    }
                    className={currentBtnClass}
                  >
                    {stripLabel}
                  </motion.button>
                </div>
              </div>
              <div
                className={`flex w-full items-center justify-center overflow-hidden ${ROW_H}`}
              >
                {contextLine(display.next)}
              </div>
              <div
                className={`flex w-full items-center justify-center overflow-hidden ${ROW_H}`}
              >
                {contextLine(display.afterNext)}
              </div>
            </motion.div>
          </div>

          {mode === "dual" && display?.cur ? (
            translation?.isEnglish ? null : (
              <motion.p
                initial={false}
                animate={{
                  opacity: loading ? 0.32 : englishText ? 0.6 : 0,
                  y: 0,
                }}
                transition={{ duration: 0.28, ease: easeIO }}
                className="mt-1 min-h-[1.25rem] max-w-[min(100%,26rem)] px-2 text-center font-sans text-sm font-normal leading-relaxed text-white/50 md:max-w-xl md:text-base"
              >
                {loading ? "…" : englishText ?? ""}
              </motion.p>
            )
          ) : null}
        </div>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="min-h-[8rem] font-serif text-xl text-white/40 md:text-2xl"
        >
          …
        </motion.p>
      )}

      <LyricModeToggle />

      <p className="mt-4 max-w-xs font-sans text-[10px] leading-relaxed text-white/25">
        Tap the current line to whisper a note — it opens with this lyric
        filled in.
      </p>
    </div>
  );
});
