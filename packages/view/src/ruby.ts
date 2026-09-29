import { wordState, type Course, type GameState, type RenderedLine } from "@silver-tongue/core";
import { bookOn } from "./course-extra";
import { readingsOf } from "./help";

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
 */
export function rubyRow(course: Course, line: RenderedLine, words: GameState["words"], now: number, ruby: RubySetting = DEFAULT_RUBY): RubySpan[] {
  if (ruby === "off" || !bookOn(course)) return [];
  return line.tokens.flatMap((tk) => {
    if (ruby === "auto" && wordState(words[tk.word], now) === "known") return [];
    const surface = line.text.slice(tk.start, tk.end);
    const text = readingsOf(course.words[tk.word], surface).at(-1);
    return text && text !== surface ? [{ start: tk.start, end: tk.end, text }] : [];
  });
}
