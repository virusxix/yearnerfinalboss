"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEchoStore } from "@/store/useEchoStore";

type Props = {
  image: string;
  colors: string[];
};

export const LivingAlbumArt = memo(function LivingAlbumArt({
  image,
  colors,
}: Props) {
  const albumFocus = useEchoStore((s) => s.albumFocus);
  const setAlbumFocus = useEchoStore((s) => s.setAlbumFocus);
  const containerRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef({ x: 0, y: 0 });
  const innerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>();

  const onMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    tiltRef.current = { x: dx * 6, y: dy * -6 };
  }, []);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      rafId.current = requestAnimationFrame(tick);
      if (innerRef.current) {
        const { x, y } = tiltRef.current;
        innerRef.current.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg)`;
      }
    };
    rafId.current = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      running = false;
      window.removeEventListener("mousemove", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [onMove]);

  const glowColor = colors[0] || "#1a1025";

  return (
    <>
      {/* Background layer: large blurred art — reduced blur for perf */}
      <div className="pointer-events-none fixed inset-0 -z-[5] flex items-center justify-center">
        <div className="album-pulse relative h-[min(120vw,140vh)] w-[min(120vw,140vh)]">
          <Image
            src={image}
            alt=""
            fill
            className="object-cover opacity-25 blur-2xl"
            sizes="50vw"
            priority
          />
        </div>
      </div>
      <div className="pointer-events-none fixed inset-0 -z-[4] bg-gradient-to-b from-transparent via-[#08060c]/70 to-[#08060c]" />

      {/* Inline album art */}
      <div ref={containerRef} className="mb-8 flex justify-center">
        <div
          ref={innerRef}
          className="album-float group relative cursor-pointer"
          style={{ willChange: "transform" }}
          onClick={() => setAlbumFocus(true)}
        >
          <div
            className="relative h-48 w-48 overflow-hidden rounded-2xl shadow-2xl transition-shadow duration-700 group-hover:shadow-[0_0_80px_rgba(160,140,220,0.3)] md:h-60 md:w-60"
            style={{
              boxShadow: `0 0 60px ${glowColor}33, 0 20px 60px rgba(0,0,0,0.4)`,
            }}
          >
            <Image
              src={image}
              alt="Album art"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 192px, 240px"
              priority
            />
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent" />
          </div>
        </div>
      </div>

      {/* Fullscreen focus mode */}
      <AnimatePresence>
        {albumFocus ? (
          <motion.div
            className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            onClick={() => setAlbumFocus(false)}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-square w-[min(80vw,80vh)] overflow-hidden rounded-3xl"
              style={{
                boxShadow: `0 0 120px ${glowColor}55, 0 0 240px ${glowColor}22`,
              }}
            >
              <Image
                src={image}
                alt="Album art"
                fill
                className="object-cover"
                sizes="80vw"
                priority
              />
              <div className="absolute inset-0 rounded-3xl border border-white/10" />
            </motion.div>
            <p className="absolute bottom-8 font-sans text-[10px] uppercase tracking-widest text-white/30">
              Click anywhere to close
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
});
