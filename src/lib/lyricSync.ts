export type LyricLine = { time: number; text: string };

export function lineIndexAtTime(lines: LyricLine[], tSec: number): number {
  if (!lines.length) return -1;
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.time <= tSec - 0.0) idx = i;
    else break;
  }
  return idx;
}
