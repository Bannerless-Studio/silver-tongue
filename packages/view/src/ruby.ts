import { wordState, type Course, type GameState, type RenderedLine } from "@silver-tongue/core";
import { bookOn } from "./course-extra";
import { displayGloss, readingsOf } from "./help";

/** When a word's reading is written over it: while it isn't known yet ("auto"), always, or never. */
export type RubySetting = "auto" | "on" | "off";
export const RUBY_SETTINGS: readonly RubySetting[] = ["auto", "on", "off"];
export const DEFAULT_RUBY: RubySetting = "auto";

/** The setting after this one, for a row that cycles through them. */
export const nextRuby = (r: RubySetting): RubySetting => RUBY_SETTINGS[(RUBY_SETTINGS.indexOf(r) + 1) % RUBY_SETTINGS.length];

/** One reading to write over the part of a line from `start` to `end`. */
export interface RubySpan {
  start: number;
  end: number;
  text: string;
}

/**
 * The readings written over a line's words: each word's plainest reading, as that word is written in
 * the line. "auto" gives them for the words not known yet, "on" for every word, "off" for none; a
 * course without the Book (see bookOn) has none whatever the setting. A word
 * with no reading, or whose reading is just its own spelling, gets none.
 * `onboard` (see onboarding): a word not known yet also carries its short gloss, "minjun · Min-jun".
 */
export function rubyRow(course: Course, line: RenderedLine, words: GameState["words"], now: number, ruby: RubySetting = DEFAULT_RUBY, onboard = false): RubySpan[] {
  if (ruby === "off" || !bookOn(course)) return [];
  return line.tokens.flatMap((tk) => {
    const known = wordState(words[tk.word], now) === "known";
    if (ruby === "auto" && known) return [];
    const surface = line.text.slice(tk.start, tk.end);
    const reading = readingsOf(course.words[tk.word], surface).at(-1);
    if (!reading || reading === surface) return [];
    const gloss = onboard && !known ? displayGloss(course.words[tk.word]) : "";
    return [{ start: tk.start, end: tk.end, text: gloss ? `${reading} · ${gloss}` : reading }];
  });
}

/** While fewer words than this have been heard, readings on a course with the Book carry short glosses too. */
export const ONBOARDING_WORDS = 10;

/** How many words the player has heard at all: met, shaky or known. */
export function heardCount(words: GameState["words"], now: number): number {
  return Object.keys(words).filter((w) => wordState(words[w], now) !== "unseen").length;
}

/**
 * Whether a line said when `heard` words had been heard (count them before the line's own new words)
 * is in the onboarding window: a course with the Book glosses its readings until ONBOARDING_WORDS
 * words are heard, then readings only. A course without the Book: never.
 */
export function onboarding(course: Course, heard: number): boolean {
  return bookOn(course) && heard < ONBOARDING_WORDS;
}
