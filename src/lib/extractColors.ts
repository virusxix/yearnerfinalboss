/**
 * Sample dominant colors from a remote image (requires CORS).
 * Falls back to a moody default palette if the canvas is tainted or loading fails.
 */
export async function extractDominantColors(
  imageUrl: string,
  count = 4
): Promise<string[]> {
  const fallback = ["#1a1025", "#2d1f3d", "#0d1a2b", "#3d2438"];
  if (typeof window === "undefined" || !imageUrl) return fallback;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 32;
        const h = 32;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          r = Math.min(255, Math.round(r / 32) * 32);
          g = Math.min(255, Math.round(g / 32) * 32);
          b = Math.min(255, Math.round(b / 32) * 32);
          const key = `${r},${g},${b}`;
          const cur = buckets.get(key) || { r, g, b, n: 0 };
          cur.n += 1;
          buckets.set(key, cur);
        }
        const sorted = Array.from(buckets.values()).sort((x, y) => y.n - x.n);
        const out = sorted.slice(0, count).map(
          (x) => `#${[x.r, x.g, x.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
        );
        while (out.length < count) out.push(fallback[out.length % fallback.length]);
        resolve(out);
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });
}
