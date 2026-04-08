"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore } from "@/store/useEchoStore";

type Props = {
  songId: string | null;
};

const POSITIONS = [
  { x: "8%", y: "18%" },
  { x: "72%", y: "12%" },
  { x: "15%", y: "72%" },
  { x: "78%", y: "68%" },
  { x: "45%", y: "82%" },
  { x: "82%", y: "38%" },
  { x: "6%", y: "45%" },
];

export const WhisperOverlay = memo(function WhisperOverlay({ songId }: Props) {
  const active = useEchoStore((s) => s.whisperModeActive);
  const whispers = useEchoStore((s) => s.whispers);

  const fragments = useMemo(() => {
    if (!songId) return [];
    return whispers
      .filter((w) => w.songId === songId)
      .slice(0, 7)
      .map((w, i) => ({
        ...w,
        pos: POSITIONS[i % POSITIONS.length],
      }));
  }, [whispers, songId]);

  if (!active || fragments.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <AnimatePresence>
        {fragments.map((f, i) => (
          <motion.div
            key={f.id}
            className="absolute max-w-[200px]"
            style={{ left: f.pos.x, top: f.pos.y }}
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: [0, 0.55, 0.55, 0],
              y: [12, 0, -4, -12],
            }}
            transition={{
              duration: 8,
              delay: i * 1.6,
              repeat: Infinity,
              repeatDelay: fragments.length * 1.6,
              ease: "easeInOut",
            }}
          >
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-violet-200/30">
              To: {f.forWhom}
            </p>
            <p className="mt-1 font-serif text-sm leading-snug text-white/30">
              {f.note.length > 60 ? `${f.note.slice(0, 60)}…` : f.note}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
