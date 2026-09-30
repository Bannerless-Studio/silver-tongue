import type { Course } from "@silver-tongue/core";
import { extra, type Letter } from "./course-extra";
import { romanize } from "./desk";
import type { Text } from "./text";

/** One group of the Book's letter chart, named in the learner's language. */
export interface LettersGroupView {
  id: string;
  label: string;
  letters: Letter[];
}

/** The course's letter chart, ready to draw; empty when the language has none. */
export function lettersView(course: Course, t: Text): LettersGroupView[] {
  return (extra(course).letters?.groups ?? []).map((g) => {
    const id = `letters-group-${g.id}`;
    return { id: g.id, label: t.has(id) ? t(id) : g.id, letters: g.letters };
  });
}

/** Whether the Book has a Letters tab for this course. */
export const hasLetters = (course: Course): boolean => (extra(course).letters?.groups.length ?? 0) > 0;

/** One step of the how-to-read guide, ready to draw: its wording, and each example with its reading and clip. */
export interface GuideStepView {
  id: string;
  text: string;
  examples: { text: string; reading: string; audio: string[] }[];
}

/** The Book's how-to-read guide; empty when the language has none. Readings come from the game's own romanization. */
export function guideView(course: Course, t: Text): GuideStepView[] {
  return (extra(course).letters?.guide ?? []).map((s) => ({
    id: s.id,
    text: t(`letters-guide-${s.id}`),
    examples: (s.examples ?? []).map((text, i) => ({ text, reading: romanize(text), audio: s.audio?.[i] ?? [] })),
  }));
}
