export type LyricLine = { time: number; text: string };

/**
 * Many synced dumps append an English gloss after the native line, separated by
 * a tab (often shown as ^I) or a caret (e.g. Thai^English). Dual mode would
 * otherwise show that whole string plus /api/translate again.
 */
export function normalizeLyricDisplayText(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const fromTab = stripBilingualGloss(t, "tab");
  if (fromTab) return fromTab;
  const fromCaret = stripBilingualGloss(t, "caret");
  return fromCaret ?? t;
}

function stripBilingualGloss(
  t: string,
  kind: "tab" | "caret"
): string | null {
  let first: string;
  let rest: string;
  if (kind === "tab") {
    if (!/\t/.test(t)) return null;
    const parts = t.split(/\t+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    first = parts[0]!;
    rest = parts.slice(1).join(" ");
  } else {
    const idx = t.indexOf("^");
    if (idx < 0) return null;
    first = t.slice(0, idx).trim();
    rest = t.slice(idx + 1).trim();
    if (!first || !rest) return null;
  }
  if (!hasStrongNonLatinScript(first) || !isPrimarilyLatinLetters(rest))
    return null;
  return first;
}

function isPrimarilyLatinLetters(s: string): boolean {
  const letters = s.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters.length) return false;
  let latin = 0;
  for (const ch of letters) {
    if (ch.charCodeAt(0) <= 0x024f) latin++;
  }
  return latin / letters.length > 0.82;
}

function hasStrongNonLatinScript(s: string): boolean {
  return /[\u0E00-\u0E7F\u0E80-\u0EFF\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0600-\u06FF\u0400-\u04FF]/.test(
    s
  );
}

export function lineIndexAtTime(lines: LyricLine[], tSec: number): number {
  if (!lines.length) return -1;
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.time <= tSec - 0.0) idx = i;
    else break;
  }
  return idx;
}
