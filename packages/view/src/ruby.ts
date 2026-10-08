import { wordState, type Course, type GameState, type RenderedLine } from "@silver-tongue/core";
import { bookOn } from "./course-extra";
import { groupReading, inForm, readingGroups } from "./help";

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
 * The readings written over a line's words, one per word group: a word and the words after it that
 * attach to it (their `attach`, written right after it with no space: a noun and its particle) share one
 * reading covering the whole group, their readings run together ("ireumi", by joinReadings). In a language
 * that writes spaces between words (a `tileGap`), any words written together are one group: a number and
 * the number after it ("samcheon"); in Japanese, a run of kanji numerals is one number ("hyakugojū", see
 * readingGroups). Each word is read by its
 * plainest reading as it is written in the line; a word with no reading, or whose reading is just its
 * own spelling, adds none, and a group none of whose words adds one gets none. "auto" gives a group its reading while any
 * word in it isn't known yet, or while any word in it is written in a changed form (du for dul: the game counts
 * hearing the word, not each form, so a form keeps its reading); "on" always, "off" never. A course without
 * the Book (see bookOn) has none whatever the setting.
 */
export function rubyRow(course: Course, line: RenderedLine, words: GameState["words"], now: number, ruby: RubySetting = DEFAULT_RUBY): RubySpan[] {
  if (ruby === "off" || !bookOn(course)) return [];
  return readingGroups(course, line).flatMap((g) => {
    if (ruby === "auto" && g.every((tk) => wordState(words[tk.word], now) === "known" && !inForm(course, line, tk))) return [];
    const start = g[0].start;
    const end = g.at(-1)!.end;
    const text = groupReading(course, line, g, true);
    if (!text) return [];
    return [{ start, end, text }];
  });
}


/** While fewer words than this have been heard, an NPC's line on a course with the Book comes with its reading and meaning. */
export const ONBOARDING_WORDS = 10;

/** How many words the player has heard at all: met, shaky or known. */
export function heardCount(words: GameState["words"], now: number): number {
  return Object.keys(words).filter((w) => wordState(words[w], now) !== "unseen").length;
}

/**
 * Whether a line said when `heard` words had been heard (count them before the line's own new words)
 * is in the onboarding window: a course with the Book shows an NPC line's reading and meaning under it
 * (the row `?` opens) until ONBOARDING_WORDS words are heard; after that the row is on demand only.
 * A course without the Book: never.
 */
export function onboarding(course: Course, heard: number): boolean {
  return bookOn(course) && heard < ONBOARDING_WORDS;
}

/**
 * A line cut into what a page draws: the text between words, and words (by token index) under the
 * reading they share, if any. A reading covers its whole word group as one ruby, and takes in the
 * punctuation written right after the group (`tail`: "?" in "…ssi?"), so a reading wider than its
 * words doesn't push the punctuation away. With no readings, every word is a piece of its own.
 */
export type LinePiece = { gap: string } | { tokens: number[]; tail: string; reading?: string };

export function lineParts(line: RenderedLine, spans: RubySpan[]): LinePiece[] {
  const out: LinePiece[] = [];
  let at = 0;
  const { tokens, text } = line;
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.start < at) continue;
    if (tk.start > at) out.push({ gap: text.slice(at, tk.start) });
    const span = spans.find((s) => s.start === tk.start);
    if (!span) {
      out.push({ tokens: [i], tail: "" });
      at = tk.end;
      continue;
    }
    const group = [i];
    while (i + 1 < tokens.length && tokens[i + 1].end <= span.end) group.push(++i);
    const end = tokens[i].end;
    const next = tokens[i + 1]?.start ?? text.length;
    const tail = /^[^\s]*/.exec(text.slice(end, next))![0];
    out.push({ tokens: group, tail, reading: span.text });
    at = end + tail.length;
  }
  if (at < text.length) out.push({ gap: text.slice(at) });
  return out;
}
