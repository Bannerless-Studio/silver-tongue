// The opening of a new game on a course with the Book: the story rises as a crawl, then one name screen.

/** crawl: the story is still moving (Enter and taps do nothing); ready: it has stopped and the prompt
 * pulses; name: the name screen. */
export type OpeningStage = "crawl" | "ready" | "name";
/** settled: the crawl stopped (or, with reduced motion, its wait ran out); next: Enter or a tap. */
export type OpeningEvent = "settled" | "next";

export function openingStep(stage: OpeningStage, ev: OpeningEvent): OpeningStage {
  if (stage === "crawl" && ev === "settled") return "ready";
  if (stage === "ready" && ev === "next") return "name";
  return stage;
}

/** How long the crawl moves, and how long a reduced-motion screen waits before its prompt. */
export const CRAWL_MS = 14_000;
export const STILL_MS = 3_000;

/** A paragraph split after its first sentence, so the sentence can be drawn bold. */
export function firstSentence(text: string): [string, string] {
  const m = /^.*?[.!?。！？](?=\s|$)/su.exec(text);
  if (!m) return [text, ""];
  return [m[0], text.slice(m[0].length)];
}
