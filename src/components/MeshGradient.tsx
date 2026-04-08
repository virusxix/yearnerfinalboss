"use client";

import { useEffect, useRef } from "react";

type Props = {
  colors: string[];
  className?: string;
  reducedMotion?: boolean;
};

const FALLBACK = ["#1a1025", "#2d1f3d", "#0d1a2b", "#3d2438"];
const RENDER_SCALE = 0.35;

export function MeshGradient({
  colors,
  className = "",
  reducedMotion = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorsRef = useRef(colors);
  const raf = useRef<number>();

  colorsRef.current = colors;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cw = 0;
    let ch = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cw = Math.floor(w * RENDER_SCALE);
      ch = Math.floor(h * RENDER_SCALE);
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      if (!reducedMotion) {
        raf.current = requestAnimationFrame(draw);
      }

      const c = colorsRef.current.length >= 4 ? colorsRef.current : FALLBACK;
      const p = t * 0.00006;

      const g = ctx.createRadialGradient(
        cw * (0.35 + Math.sin(p) * 0.08),
        ch * (0.4 + Math.cos(p * 0.9) * 0.06),
        0,
        cw * 0.5,
        ch * 0.5,
        Math.max(cw, ch) * 0.85
      );
      g.addColorStop(0, c[0]!);
      g.addColorStop(0.45, c[1]!);
      g.addColorStop(0.72, c[2]!);
      g.addColorStop(1, c[3]!);

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);

      const g2 = ctx.createRadialGradient(
        cw * (0.7 + Math.cos(p * 1.1) * 0.1),
        ch * (0.25 + Math.sin(p * 0.7) * 0.08),
        0,
        cw * 0.65,
        ch * 0.35,
        Math.max(cw, ch) * 0.55
      );
      g2.addColorStop(0, `${c[2]}66`);
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, cw, ch);
    };
    if (reducedMotion) {
      draw(performance.now());
      const id = window.setInterval(() => draw(performance.now()), 8000);
      return () => {
        window.removeEventListener("resize", resize);
        window.clearInterval(id);
      };
    }
    raf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={ref}
      className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
      style={{ imageRendering: "auto" }}
      aria-hidden
    />
  );
}
