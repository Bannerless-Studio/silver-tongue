// The opening of a new game on a course with the Book: the story's paragraphs come in one at a time, then
// one name screen.
import type { Course } from "@silver-tongue/core";
import { bookOn } from "@silver-tongue/view";

/** crawl: the story is still coming in (Enter and taps do nothing); ready: the last paragraph has settled
 * and the prompt pulses; name: the name screen. */
export type OpeningStage = "crawl" | "ready" | "name";
/** settled: the last paragraph has settled; next: Enter or a tap. */
export type OpeningEvent = "settled" | "next";

export function openingStep(stage: OpeningStage, ev: OpeningEvent): OpeningStage {
  if (stage === "crawl" && ev === "settled") return "ready";
  if (stage === "ready" && ev === "next") return "name";
  return stage;
}

/** How long one paragraph takes to slide in and fade up. */
export const ENTER_MS = 900;
const MS_PER_CHAR = 55;
const MIN_READ_MS = 1_500;
const MAX_READ_MS = 4_000;

/** For each paragraph, how long after it starts coming in the next one starts: time to read it, by its
 * length. The last entry is how long the last paragraph would be read; nothing waits on it. */
export function paragraphDelays(paragraphs: string[]): number[] {
  return paragraphs.map((p) => Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, [...p].length * MS_PER_CHAR)));
}

/** A book course with no saved game and a name to ask opens straight on the story, skipping the title
 * screen's "New game" (which would be its only choice). */
export function opensOnStory(course: Course, hasSave: boolean): boolean {
  return !hasSave && course.needsName === true && bookOn(course);
}

/** A paragraph split after its first sentence, so the sentence can be drawn bold. */
export function firstSentence(text: string): [string, string] {
  const m = /^.*?[.!?。！？](?=\s|$)/su.exec(text);
  if (!m) return [text, ""];
  return [m[0], text.slice(m[0].length)];
}
