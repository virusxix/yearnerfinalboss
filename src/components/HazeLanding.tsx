"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const RAIN_VIDEO =
  "https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-window-on-a-gray-afternoon-44297-large.mp4";

const LANDING_LYRIC =
  "All these distractions yet I find myself still yearning for you at the end of the day.";

function LandingInner() {
  const params = useSearchParams();
  const err = params.get("error");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50"
        style={{ filter: "blur(8px) saturate(0.85)" }}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster=""
      >
        <source src={RAIN_VIDEO} type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0610]/80 via-[#120a18]/70 to-[#08060c]/95" />

      <div className="relative z-10 flex w-full max-w-[min(100%,72rem)] flex-col items-center justify-center px-6 text-center">
        <h1 className="sr-only">Echo &amp; Haze</h1>
        <p className="font-sans text-xs uppercase tracking-[0.35em] text-white/45">
          Echo &amp; Haze
        </p>
        <div className="lyric-text-fade mt-8 md:mt-10">
          <motion.p
            className="lyric-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.42, 0, 0.58, 1] }}
          >
            {LANDING_LYRIC}
          </motion.p>
        </div>
        <p className="mt-8 font-sans text-sm leading-relaxed text-white/55 md:mt-10">
          An immersive player for mood, memory, and the line that hits you when
          the world goes quiet.
        </p>

        {err ? (
          <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-2 font-sans text-xs text-rose-200/90">
            {decodeURIComponent(err)}
          </p>
        ) : null}

        <motion.div
          className="mt-12"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/api/auth/spotify"
            className="group relative inline-flex items-center justify-center rounded-full px-12 py-4 font-sans text-sm font-medium tracking-wide text-white/95"
          >
            <span
              className="absolute inset-0 rounded-full opacity-60 blur-xl transition-opacity duration-700 group-hover:opacity-90"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(180,160,255,0.5), transparent 65%)",
              }}
            />
            <span className="absolute inset-0 rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-700 group-hover:border-white/35 group-hover:bg-white/[0.14]" />
            <span className="relative">Enter the Haze</span>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

export function HazeLanding() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#08060c] text-white/40">
          …
        </div>
      }
    >
      <LandingInner />
    </Suspense>
  );
}
