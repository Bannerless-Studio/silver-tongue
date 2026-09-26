import type { Course, RenderedLine, WordId } from "@silver-tongue/core";

export interface WordCard {
  word: WordId;
  text: string;
  readings: string[];
  gloss: string;
  clips: string[];
}

export interface SentenceCard {
  text: string;
  /** each word's last (plainest) reading */
  reading: string;
  meaning: string;
  clips: string[];
}

/** What looking up a word shows. */
export function wordCard(course: Course, id: WordId): WordCard {
  const w = course.words[id];
  return { word: id, text: w.w, readings: w.readings ?? [], gloss: w.gloss, clips: w.audio ?? [] };
}

/** What asking about a whole line shows; undefined when the line has no meaning written. */
export function sentenceCard(course: Course, line: RenderedLine): SentenceCard | undefined {
  if (!line.meaning) return undefined;
  const reading = line.tokens.flatMap((tk) => course.words[tk.word]?.readings?.at(-1) ?? []).join(" ");
  return { text: line.text, reading, meaning: line.meaning, clips: line.audio ?? [] };
}
