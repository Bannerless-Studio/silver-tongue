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

/** A gloss split into senses at a top-level ";" or ",": one inside "(...)" doesn't count. */
function glossSenses(gloss: string): string[] {
  const senses: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < gloss.length; i++) {
    const c = gloss[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if ((c === ";" || c === ",") && depth === 0) {
      senses.push(gloss.slice(start, i));
      start = i + 1;
    }
  }
  senses.push(gloss.slice(start));
  return senses.map((s) => s.trim()).filter(Boolean);
}

/** True once a sense is nothing but one "(...)" aside, e.g. "(question particle)". */
function isPureAside(sense: string): boolean {
  return /^\(.*\)$/.test(sense);
}

/**
 * A sense with a leading or trailing "(...)" aside dropped (an aside in the middle stays, since
 * removing it would leave two floating halves). "you (informal)" -> "you";
 * "(pronoun) this" -> "this".
 */
function dropAsides(sense: string): string {
  return sense.replace(/^\([^)]*\)\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export interface GlossHeuristic {
  text: string;
  /** true when every sense was a pure aside, so `text` is that aside's own text, shortened */
  fellBack: boolean;
}

/**
 * A gloss cut down to a short display form, never "":
 * - the first sense that isn't a pure aside, with its own leading/trailing aside dropped
 *   ("good; appropriate; proper" -> "good"; "you (informal)" -> "you"; "(pronoun) this" -> "this");
 * - if every sense is a pure aside (e.g. a whole gloss of "(question particle for \"yes-no\"
 *   questions)"), the first one's own words, cut to at most 3
 *   ("(question particle for \"yes-no\" questions)" -> "question particle for").
 * The full gloss (every sense) is still what the [w] word card shows. Callers that have a
 * curated override for this word should prefer it over this heuristic; see `displayGloss`.
 */
export function heuristicGloss(gloss: string): GlossHeuristic {
  const senses = glossSenses(gloss);
  for (const sense of senses) {
    if (isPureAside(sense)) continue;
    const text = dropAsides(sense);
    if (text) return { text, fellBack: false };
  }
  const first = senses[0] ?? gloss;
  const inner = first.replace(/^\(|\)$/g, "").trim();
  const words = inner.split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
  return { text: words || "?", fellBack: true };
}

/** `heuristicGloss(gloss).text`: the heuristic's short form on its own, for direct use and tests. */
export function shortGloss(gloss: string): string {
  return heuristicGloss(gloss).text;
}

/** A word's short display gloss: its curated override when it has one, else the heuristic. */
export function displayGloss(w: { gloss: string; short?: string } | undefined): string {
  if (w?.short) return w.short;
  return shortGloss(w?.gloss ?? "");
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

export interface FirstTimeWord {
  word: WordId;
  text: string;
  reading: string;
  gloss: string;
}

/**
 * The words in `line` that are being met for the first time (their ids in `fresh`), each once, in
 * the order they first appear. Used to gloss a new NPC line so a beginner isn't left guessing.
 */
export function firstTimeWords(course: Course, line: RenderedLine, fresh: Set<WordId>): FirstTimeWord[] {
  const seen = new Set<WordId>();
  const out: FirstTimeWord[] = [];
  for (const tk of line.tokens) {
    if (!fresh.has(tk.word) || seen.has(tk.word)) continue;
    seen.add(tk.word);
    const w = course.words[tk.word];
    out.push({ word: tk.word, text: line.text.slice(tk.start, tk.end), reading: w?.readings?.at(-1) ?? "", gloss: displayGloss(w) });
  }
  return out;
}

/** `firstTimeWords`, joined as one dim line: each word's text, reading and gloss, separated by " · ". Undefined when there are none. */
export function firstTimeGloss(course: Course, line: RenderedLine, fresh: Set<WordId>): string | undefined {
  const words = firstTimeWords(course, line, fresh);
  if (!words.length) return undefined;
  return words.map((w) => [w.text, w.reading, w.gloss].filter(Boolean).join(" ")).join(" · ");
}
