// The opening of a new game on a course with the Book: the story's paragraphs come up from the bottom edge
// one at a time, then one name screen.
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

/** Travel time for a paragraph coming up from the bottom edge: scaled by the distance so a short trip isn't
 * slow, between MIN_TRAVEL_MS (no distance) and MAX_TRAVEL_MS (a full screen). */
export const MIN_TRAVEL_MS = 1_200;
export const MAX_TRAVEL_MS = 1_800;
/** Pause after a paragraph settles before the next one starts. */
export const PAUSE_MS = 350;
/** Pause after the last paragraph settles before the prompt appears. */
export const PROMPT_MS = 400;

export function travelMs(distance: number, viewport: number): number {
  const f = viewport > 0 ? Math.min(1, Math.max(0, distance / viewport)) : 1;
  return Math.round(MIN_TRAVEL_MS + (MAX_TRAVEL_MS - MIN_TRAVEL_MS) * f);
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
