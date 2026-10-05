// Scribe mode (lab): in the first conversations the player reads their line in Latin letters and types what it means,
// then says a reply by typing its meaning. Pure rules and wording here; the page draws it (quiet-web/src/ui/Scribe.tsx).
import type { RenderedLine, WordId } from "@silver-tongue/core";
import { romanize } from "./desk";
import { normalizeMeaning } from "./meaning";

/** The scenes played in scribe mode; every later scene keeps the normal flow. */
export const SCRIBE_SCENES: readonly string[] = ["room-wake", "street-hello"];

export const isScribeScene = (scene: string | undefined): boolean => !!scene && SCRIBE_SCENES.includes(scene);

/** The hands-off arc, in one place: the first exchanges light the help button at the first miss, the later ones after SCRIBE_HELP_LATE. */
export const SCRIBE_EARLY_EXCHANGES = 2;
export const SCRIBE_HELP_LATE = 3;
/** Misses on one field before its help button lights. `index`: how many scribe exchanges this course has begun before this one. */
export const scribeHelpAfter = (index: number): number => (index < SCRIBE_EARLY_EXCHANGES ? 1 : SCRIBE_HELP_LATE);
/** Only the very first scribe exchange shows its worked example. */
export const scribeShowsExample = (index: number): boolean => index === 0;

/** Where the page keeps how many scribe exchanges a course has begun (the worked example is the first's alone). */
export const scribeCountKey = (course: string): string => `silver-tongue:scribe-count:${course}`;

/**
 * Other ways to say a meaning, for the lines of the scribe scenes (matched whole, after the same tidying as the meaning).
 * Keyed by the meaning as written in content/learner/en/lines-ko. Spellings like "thanks" and "bye" are already
 * handled by the matcher. Core's rendered lines carry no such field, so the list lives here, not in the .ftl files.
 */
export const SCRIBE_ACCEPTS: Record<string, string[]> = {
  "Who is it?": ["who is there", "who is that", "who is this"],
  "I don't know.": ["no idea", "dunno", "i have no idea"],
  "Yes, I do.": ["yes", "i do", "yes i know korean"],
  "Yes, thank you.": ["yes thank you very much"],
  "Thank you.": ["thank you very much", "thanks a lot"],
  "Hello.": ["good morning", "good day"],
  "Goodbye.": ["see you", "farewell"],
  "Well… goodbye.": ["well goodbye"],
  "Sit here.": ["sit down", "sit down here", "have a seat", "have a seat here", "take a seat", "take a seat here", "please sit", "sit", "sit down please"],
  "Do you know Korean?": ["do you speak korean", "can you speak korean", "you know korean", "you speak korean", "know korean", "speak korean", "do you understand korean", "can you understand korean"],
  "I'm Grandpa Park.": ["grandfather park", "i am grandfather park", "he is park", "he is grandpa park", "he is grandfather park", "my name is park", "i am park"],
  "Hello, Grandpa Park.": ["hello", "hello grandfather park", "hello grandpa", "hello park", "hello grandfather"],
  "What's your name?": ["your name", "what are you called", "may i ask your name"],
  "No, I don't.": ["no", "i do not", "no i do not know korean", "i do not know korean", "i do not speak korean", "no i do not speak korean"],
};
const ACCEPTS = new Map(Object.entries(SCRIBE_ACCEPTS).map(([k, v]) => [normalizeMeaning(k), v]));
/** The other accepted ways to say a line's meaning. */
export const scribeAccepts = (meaning: string): string[] => ACCEPTS.get(normalizeMeaning(meaning)) ?? [];

/** A piece of a line in Latin letters: a word (with its id, so a tap can look it up) or what lies between words. */
export interface RomanSeg {
  text: string;
  word?: WordId;
  /** the word as written in Hangul, for its look-up card */
  surface?: string;
}

const isHangul = (ch: string | undefined): boolean => !!ch && /[\uac00-\ud7a3]/.test(ch);

/**
 * A line read in Latin letters, one piece per word. Each word is romanised by itself so a tap maps to its id; the gaps
 * (spaces, punctuation) pass through. A sentence starts with a capital, as written, and a name set in Latin letters
 * (the player's) is kept apart from the Hangul after it. The desk's `romanize` is used as it is.
 */
export function romanSegments(line: RenderedLine): RomanSeg[] {
  const out: RomanSeg[] = [];
  const text = line.text;
  const push = (from: number, to: number, word?: WordId) => {
    if (isHangul(text[from]) && /[A-Za-z0-9]/.test(text[from - 1] ?? "")) out.push({ text: " " });
    out.push({ text: romanize(text.slice(from, to)).replace(/…{2,}/g, "…"), ...(word !== undefined ? { word, surface: text.slice(from, to) } : {}) });
  };
  let at = 0;
  for (const tk of [...line.tokens].sort((a, b) => a.start - b.start)) {
    if (tk.start > at) push(at, tk.start);
    push(tk.start, tk.end, tk.word);
    at = tk.end;
  }
  if (at < text.length) push(at, text.length);
  // Capitals: the first letter, and the first after a sentence's end.
  let start = true;
  return out.map((seg) => {
    let t = "";
    for (const ch of seg.text) {
      if (start && /\p{L}/u.test(ch)) (t += ch.toUpperCase()), (start = false);
      else t += ch;
      if (/[.?!]/.test(ch)) start = true;
    }
    return { ...seg, text: t };
  });
}

/** `romanSegments` as one string. */
export const romanLine = (line: RenderedLine): string => romanSegments(line).map((s) => s.text).join("");

/** A line's meaning as the learner reads it (core has put the player's name in), or "" when it has none. */
export const lineMeaning = (line: RenderedLine): string => line.meaning ?? "";

