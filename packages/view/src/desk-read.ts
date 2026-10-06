// Reading a paper one syllable at a time: the letters each syllable is made of, the sum they make,
// the answer check, and the progress kept between visits. Pure: the desk page only draws it.
// Syllables are taken apart with Unicode maths (the Hangul Syllables block, then the compatibility jamo), so this
// knows one script by design, like `romanize`.
import type { Course } from "@silver-tongue/core";
import { deskPapers, readsAs, romanize, type DeskPaper } from "./desk";
import { extra, type Letter, type LetterGroup } from "./course-extra";

/** Where the reading progress is kept in the browser. */
export const deskKey = (course: string): string => `silver-tongue:desk:${course}`;

export interface DeskProgress {
  /** syllables read so far in each paper (spaces, digits and punctuation never count) */
  at: Record<string, number>;
  /** the letters met: every syllable shown so far adds its letters (`letterKey`) */
  met: string[];
}
export const emptyProgress = (): DeskProgress => ({ at: {}, met: [] });

/** Parsed from storage: anything malformed is forgotten. */
export function parseProgress(v: unknown): DeskProgress {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const at: Record<string, number> = {};
  if (o.at && typeof o.at === "object") for (const [k, n] of Object.entries(o.at)) if (typeof n === "number" && n >= 0) at[k] = Math.floor(n);
  return { at, met: Array.isArray(o.met) ? o.met.filter((x): x is string => typeof x === "string") : [] };
}

const isSyllableCode = (c: number): boolean => c >= 0xac00 && c <= 0xd7a3;
export const isSyllable = (ch: string): boolean => isSyllableCode(ch.codePointAt(0) ?? 0);

export interface PaperSyllable {
  /** the line it is in */
  line: number;
  /** its character index in the line */
  index: number;
  ch: string;
}
/** Every syllable of a paper, in reading order. Everything else in its lines passes through unasked. */
export function paperSyllables(paper: DeskPaper): PaperSyllable[] {
  const lines = paper.lines.map((l, line) => ({ l, line }));
  if (paper.required?.length) lines.sort((a, b) => Number(paper.required!.includes(b.l.id)) - Number(paper.required!.includes(a.l.id)));
  return lines.flatMap(({ l, line }) => [...l.text].flatMap((ch, index) => (isSyllable(ch) ? [{ line, index, ch }] : [])));
}

/** Whether a line has been read out: it has syllables and all of them are behind `at` (a line with none is never "read"). */
export function lineRead(syls: PaperSyllable[], line: number, at: number): boolean {
  const mine = syls.map((s, i) => ({ s, i })).filter((x) => x.s.line === line);
  return mine.length > 0 && mine.every((x) => x.i < at);
}

/** What the player typed as one syllable's reading (either spelling of a letter with two sounds is fine). */
export const readsSyllable = (typed: string, ch: string): boolean => isSyllable(ch) && readsAs(typed, ch);

// ---- letters ----

/** The chart's group ids for initials, vowels and final consonants. */
const G = { initial: "consonants", medial: "vowels", final: "finals" } as const;

export const letterKey = (group: string, ch: string): string => `${group}:${ch}`;

export interface LetterRef {
  /** `letterKey` of its chart entry */
  key: string;
  group: string;
  letter: Letter;
}

const INITIALS = [0x3131, 0x3132, 0x3134, 0x3137, 0x3138, 0x3139, 0x3141, 0x3142, 0x3143, 0x3145, 0x3146, 0x3147, 0x3148, 0x3149, 0x314a, 0x314b, 0x314c, 0x314d, 0x314e];
const FINALS = [0, 0x3131, 0x3132, 0x3133, 0x3134, 0x3135, 0x3136, 0x3137, 0x3139, 0x313a, 0x313b, 0x313c, 0x313d, 0x313e, 0x313f, 0x3140, 0x3141, 0x3142, 0x3144, 0x3145, 0x3146, 0x3147, 0x3148, 0x314a, 0x314b, 0x314c, 0x314d, 0x314e];
/** letters that split in two when the chart has no entry for them: double consonants, compound finals, compound vowels */
const SPLIT: Record<number, [number, number]> = {
  0x3132: [0x3131, 0x3131], 0x3138: [0x3137, 0x3137], 0x3143: [0x3142, 0x3142], 0x3146: [0x3145, 0x3145], 0x3149: [0x3148, 0x3148],
  0x3133: [0x3131, 0x3145], 0x3135: [0x3134, 0x3148], 0x3136: [0x3134, 0x314e], 0x313a: [0x3139, 0x3131], 0x313b: [0x3139, 0x3141],
  0x313c: [0x3139, 0x3142], 0x313d: [0x3139, 0x3145], 0x313e: [0x3139, 0x314c], 0x313f: [0x3139, 0x314d], 0x3140: [0x3139, 0x314e], 0x3144: [0x3142, 0x3145],
  0x3158: [0x3157, 0x314f], 0x3159: [0x3157, 0x3150], 0x315a: [0x3157, 0x3163], 0x315d: [0x315c, 0x3153], 0x315e: [0x315c, 0x3154], 0x315f: [0x315c, 0x3163], 0x3162: [0x3161, 0x3163],
};

export const letterChart = (course: Course): LetterGroup[] => extra(course).letters?.groups ?? [];

/** A jamo's chart entry for a role: a final looks in the finals first, then among the consonants (a doubled consonant at the end of a block, say). */
function entry(chart: LetterGroup[], role: keyof typeof G, code: number): LetterRef | undefined {
  const ch = String.fromCodePoint(code);
  const order = role === "final" ? [G.final, G.initial] : [G[role]];
  for (const g of order) {
    const letter = chart.find((x) => x.id === g)?.letters.find((l) => l.ch === ch);
    if (letter) return { key: letterKey(g, ch), group: g, letter };
  }
  return undefined;
}
function place(chart: LetterGroup[], role: keyof typeof G, code: number): LetterRef[] {
  const one = entry(chart, role, code);
  if (one) return [one];
  const split = SPLIT[code];
  return split ? split.flatMap((c) => place(chart, role, c)) : [];
}

/** The letters a syllable is made of, in reading order (a repeated letter once). A letter the chart lists as its own
 * (a compound vowel, a double consonant) stays one; a compound the chart doesn't list splits in two. */
export function syllableLetters(chart: LetterGroup[], ch: string): LetterRef[] {
  const c = (ch.codePointAt(0) ?? 0) - 0xac00;
  if (!isSyllableCode(c + 0xac00)) return [];
  const i = Math.floor(c / 588), m = Math.floor((c % 588) / 28), f = c % 28;
  const all = [...place(chart, "initial", INITIALS[i]), ...place(chart, "medial", 0x314f + m), ...(f ? place(chart, "final", FINALS[f]) : [])];
  return all.filter((r, k) => all.findIndex((x) => x.key === r.key) === k);
}

/** The keys of the letters of every syllable in some text. */
export const textLetterKeys = (chart: LetterGroup[], text: string): string[] => [...text].flatMap((ch) => syllableLetters(chart, ch).map((r) => r.key));

/** Letters met so far on this course: those stored, plus every letter of a paper already read (older saves). */
export function metLetters(course: Course, progress: DeskProgress, read: ReadonlySet<string>): Set<string> {
  const chart = letterChart(course);
  const met = new Set(progress.met);
  for (const p of deskPapers(course)) for (const l of p.lines) if (read.has(p.id) || read.has(`${p.id}.${l.id}`)) for (const k of textLetterKeys(chart, l.text)) met.add(k);
  return met;
}

/** Whether the Book's letters follow the desk: a course with a chart and papers. */
export const lettersFollowDesk = (course: Course): boolean => letterChart(course).length > 0 && deskPapers(course).length > 0;

/** "N of M letters" for the Book's chart. */
export function letterCount(course: Course, met: ReadonlySet<string>): { n: number; total: number } {
  const keys = letterChart(course).flatMap((g) => g.letters.map((l) => letterKey(g.id, l.ch)));
  return { n: keys.filter((k) => met.has(k)).length, total: keys.length };
}

export interface SumTile extends LetterRef {
  /** met for the first time in this block */
  fresh: boolean;
  /** the letter as it sounds at the end of a block */
  final: boolean;
  /** how it sounds in this block: the alternative of a letter with two sounds that the block's reading uses */
  sound: string;
}

/** The sound of a letter in a block whose reading is `reading`: of "g/k" the one the reading uses there (`role`: where in the block). */
export function soundIn(letter: Letter, role: keyof typeof G, reading: string): string {
  const alts = (letter.reading ?? "").split(/\s*\/\s*/).filter(Boolean);
  const used = alts.find((a) => (role === "initial" ? reading.startsWith(a) : role === "final" ? reading.endsWith(a) : reading.includes(a)));
  return used ?? alts[0] ?? "";
}

/** The sum under a syllable: its own letters in reading order, each with its sound there; those not met before this block are `fresh`. */
export function sumTiles(chart: LetterGroup[], ch: string, before: ReadonlySet<string>): SumTile[] {
  const reading = romanize(ch);
  return syllableLetters(chart, ch).map((r) => ({
    ...r,
    fresh: !before.has(r.key),
    final: r.group === G.final,
    sound: soundIn(r.letter, r.group === G.final ? "final" : r.group === G.initial ? "initial" : "medial", reading),
  }));
}
