"use client";

import { useEffect, useState } from "react";

type TranslationResult = {
  translated: string;
  isEnglish: boolean;
};

const clientCache = new Map<string, TranslationResult>();

/** Warm the translation cache for nearby lyric lines (dual mode) without subscribing. */
export function usePrefetchTranslation(text: string | null | undefined) {
  useEffect(() => {
    const t = text?.trim();
    if (!t) return;
    if (clientCache.has(t)) return;

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        const data = (await r.json()) as TranslationResult;
        if (cancelled) return;
        clientCache.set(t, data);
        if (clientCache.size > 300) {
          const first = clientCache.keys().next().value;
          if (first) clientCache.delete(first);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text]);
}

export function useTranslation(text: string | null) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!text) {
      setResult(null);
      setLoading(false);
      return;
    }

    const cached = clientCache.get(text);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const r = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = (await r.json()) as TranslationResult;
        if (cancelled) return;

        clientCache.set(text, data);
        if (clientCache.size > 300) {
          const first = clientCache.keys().next().value;
          if (first) clientCache.delete(first);
        }
        setResult(data);
      } catch {
        if (!cancelled) setResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text]);

  return { translation: result, loading };
}
