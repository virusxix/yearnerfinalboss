import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Result = {
  translated: string;
  isEnglish: boolean;
};

const cache = new Map<string, Result>();

function hasNonLatinChars(text: string): boolean {
  const cleaned = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!cleaned.length) return false;
  let nonLatin = 0;
  for (const ch of cleaned) {
    const code = ch.charCodeAt(0);
    if (code > 0x024f) nonLatin++;
  }
  return nonLatin / cleaned.length > 0.15;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text?: string };
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ translated: "", isEnglish: true });
  }

  const cached = cache.get(text);
  if (cached) return NextResponse.json(cached);

  const nonLatin = hasNonLatinChars(text);

  if (!nonLatin) {
    const result: Result = { translated: text, isEnglish: true };
    cache.set(text, result);
    return NextResponse.json(result);
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return NextResponse.json({ translated: "", isEnglish: false });
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
    };
    const translated = data.responseData?.translatedText || "";

    const result: Result = {
      translated: translated || text,
      isEnglish: false,
    };

    cache.set(text, result);
    if (cache.size > 500) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ translated: "", isEnglish: false });
  }
}
