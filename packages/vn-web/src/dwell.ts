import type { Beat } from "./vn";

const BASE_MS = 900;
const WORD_MS = 300;
const CHAR_MS = 45;
const MIN_MS = 1400;
const MAX_MS = 7000;

/**
 * How long a beat stays up: 900ms plus 300ms for each word of a line in the language being
 * learned, or 45ms for each character of narration, between 1.4 and 7 seconds. A beat with a clip
 * waits longer still, for the sound to finish.
 */
export function dwellMs(b: Beat): number {
  const raw = b.line ? BASE_MS + b.line.tokens.length * WORD_MS : BASE_MS + (b.text?.length ?? 0) * CHAR_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, raw));
}
