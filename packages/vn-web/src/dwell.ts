import type { Beat } from "./vn";

const BASE_MS = 900;
const WORD_MS = 300;
const CHAR_MS = 45;
const MIN_MS = 1400;
const MAX_LINE_MS = 7000;
// Higher than the line ceiling: the longest mentor note in the course is 341 characters, and the
// 7s ceiling would read it at more than twice the rate the formula asks for.
const MAX_TEXT_MS = 16000;

/**
 * A beat's reading time: 900ms plus 300ms for each word of a line in the language being learned,
 * or 45ms for each character of narration, clamped to 1.4–7 seconds for a line and 1.4–16 for
 * narration. The controller keeps a beat up longer than this while a clip is playing, and while
 * the player holds it.
 */
export function dwellMs(b: Beat): number {
  if (b.line) return Math.min(MAX_LINE_MS, Math.max(MIN_MS, BASE_MS + b.line.tokens.length * WORD_MS));
  return Math.min(MAX_TEXT_MS, Math.max(MIN_MS, BASE_MS + (b.text?.length ?? 0) * CHAR_MS));
}
