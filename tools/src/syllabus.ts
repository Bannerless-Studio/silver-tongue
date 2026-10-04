import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Course, RenderedLine, WordId } from "@silver-tongue/core";

/**
 * The syllabus: what a course must teach to claim a CEFR level. Words come from a graded vocab
 * pack (for Korean, Bannerless-Studio/korean: 2000 words in A1/A2/B1 bands); grammar points are
 * hand-written per language in content/languages/<lang>/grammar.json, each with a detector the
 * learning simulator runs on the lines a player hears.
 */

export interface SyllabusWord {
  /** the pack's word id */
  id: string;
  /** dictionary form; particles keep the pack's leading "-" */
  w: string;
  pos: string;
  lv: string;
  en: string;
  /** inflected spellings the pack linked to this word */
  forms: string[];
}

export interface Syllabus {
  /** where the words came from and under what licence */
  source: string;
  license: string;
  levels: string[];
  words: SyllabusWord[];
}

export interface GrammarPoint {
  id: string;
  lv: string;
  /** the pattern as a textbook writes it, e.g. "-고 싶다" */
  label: string;
  en: string;
  /**
   * How to spot it in a line: `words` names the language's word ids that are the point (a
   * particle, a copula); `pattern` is a regular expression over the line's text, where {ㄹ} (any
   * final consonant in braces) stands for any syllable ending in it. Neither: not detectable by rule.
   */
  words?: WordId[];
  pattern?: string;
  /**
   * The stage (act) whose lines must use it. Absent: the stage of its level (A1 on 1, A2 on 2, B1 on
   * 3). A point the story needs later than its level says (past tense for the letters of act 2) names
   * that stage.
   */
  stage?: number;
}

export interface Grammar {
  note: string;
  points: GrammarPoint[];
}

/** The pack's words.json entries, as far as the syllabus reads them. */
interface PackWordJson {
  id: string;
  w: string;
  lemma?: string;
  pos?: string;
  lv: string;
  en: string;
  forms?: string[];
}

/**
 * A syllabus from a vocab pack. `levels` renames the pack's levels to the syllabus's (HSK "1" to "A1")
 * and keeps only those; without it every pack level is kept under its own name.
 */
export function buildSyllabus(pack: { levels: { id: string }[] }, words: PackWordJson[], source: string, license: string, levels?: Record<string, string>): Syllabus {
  const lv = (id: string) => (levels ? levels[id] : id);
  return {
    source,
    license,
    levels: pack.levels.map((l) => lv(String(l.id))).filter((l): l is string => !!l),
    words: words.filter((v) => lv(String(v.lv))).map((v) => ({ id: v.id, w: v.w, pos: v.pos ?? "", lv: lv(String(v.lv)), en: v.en, forms: v.forms ?? [] })),
  };
}

/** The fields of one CSV line; a field in double quotes may hold commas and "" for a quote. */
export function csvFields(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let f = "";
      i++;
      while (i < line.length && !(line[i] === '"' && line[i + 1] !== '"')) f += line[i] === '"' ? (i++, '"') : line[i], i++;
      out.push(f);
      i += 2; // the closing quote and the comma
    } else {
      const end = line.indexOf(",", i);
      out.push(line.slice(i, end < 0 ? line.length : end));
      i = end < 0 ? line.length + 1 : end + 1;
    }
  }
  return out;
}

const GODAN_I: Record<string, string> = { う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り" };

/**
 * A verb's polite forms (-ます, -ました, -ません, -ましょう), since a course writes verbs that way and the
 * JLPT lists give the dictionary form. Whether a る verb is godan (帰る: 帰ります) or ichidan (食べる: 食べます)
 * isn't in the list, so it gets both; the wrong one matches nothing.
 */
export function masuForms(verb: string): string[] {
  const stems =
    verb.endsWith("する") ? [verb.slice(0, -2) + "し"]
    : verb === "来る" || verb === "くる" ? [verb === "来る" ? "来" : "き"]
    : GODAN_I[verb.slice(-1)] ? [verb.slice(0, -1) + GODAN_I[verb.slice(-1)], ...(verb.endsWith("る") ? [verb.slice(0, -1)] : [])]
    : [];
  return stems.flatMap((st) => ["ます", "ました", "ません", "ましょう"].map((e) => st + e));
}

/**
 * A syllabus from JLPT word lists (expression,reading,meaning,tags), easiest list first. A word in
 * more than one list keeps its easiest level; its kana reading is a form, for a course that writes it
 * in kana (かぎ for 鍵), and so are a verb's polite forms (masuForms).
 */
export function buildJlptSyllabus(lists: { level: string; csv: string }[], source: string, license: string): Syllabus {
  const seen = new Set<string>();
  const words: SyllabusWord[] = [];
  for (const { level, csv } of lists) {
    for (const line of csv.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;
      const [w, reading, en] = csvFields(line);
      if (seen.has(w)) continue;
      seen.add(w);
      // A one-kana reading would match particles (か, の) to unrelated words (可, 野).
      const spellings = [w, ...(reading && reading !== w && reading.length > 1 ? [reading] : [])];
      const forms = [...new Set([...spellings.slice(1), ...(/^to /.test(en) ? spellings.flatMap(masuForms) : [])])];
      words.push({ id: `${level.toLowerCase()}-${String(words.length + 1).padStart(4, "0")}`, w, pos: "", lv: level, en, forms });
    }
  }
  return { source, license, levels: lists.map((l) => l.level), words };
}

// Hangul syllables are 0xAC00 + (initial * 21 + vowel) * 28 + final.
const FINALS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

/** A character class of every syllable that ends in `final`. */
function finalClass(final: string): string {
  const t = FINALS.indexOf(final);
  if (t < 1) throw new Error(`{${final}} is not a final consonant`);
  let out = "";
  for (let lv = 0; lv < 19 * 21; lv++) out += String.fromCharCode(0xac00 + lv * 28 + t);
  return `[${out}]`;
}

/** A detector's pattern as a RegExp, with each {ㄹ} expanded. */
export function grammarRegExp(pattern: string): RegExp {
  return new RegExp(pattern.replace(/\{(.)\}/g, (_, f: string) => finalClass(f)), "u");
}

/** The ids of the grammar points a line uses. */
export function grammarDetector(grammar: Grammar): (line: RenderedLine) => string[] {
  const rules = grammar.points.map((g) => ({ id: g.id, words: g.words ?? [], re: g.pattern ? grammarRegExp(g.pattern) : undefined }));
  return (line) => {
    const words = new Set(line.tokens.map((t) => t.word));
    return rules.filter((r) => r.words.some((w) => words.has(w)) || r.re?.test(line.text)).map((r) => r.id);
  };
}

/** Words of a gloss worth comparing: lower case, no "to"/"be"/"a" and the like. */
function glossWords(gloss: string): Set<string> {
  const stop = new Set(["to", "be", "a", "an", "the", "of", "is", "it", "do", "you", "i"]);
  return new Set(gloss.toLowerCase().match(/[a-z]+/g)?.filter((w) => !stop.has(w)) ?? []);
}

/**
 * Each course word's syllabus word, if any: matched by its spelling or one of its forms against
 * a syllabus word's spelling (without a particle's "-") or forms. When several syllabus words
 * share a spelling (이: "this", "two"), the one whose gloss shares a word with the course's gloss
 * wins, else the first (the pack lists the most frequent first).
 */
export function matchSyllabus(course: Course, syllabus: Syllabus): Map<WordId, SyllabusWord> {
  const bySpelling = new Map<string, SyllabusWord[]>();
  for (const s of syllabus.words) {
    for (const f of new Set([s.w.replace(/^-/, ""), ...s.forms])) {
      if (!bySpelling.has(f)) bySpelling.set(f, []);
      bySpelling.get(f)!.push(s);
    }
  }
  const out = new Map<WordId, SyllabusWord>();
  for (const [id, word] of Object.entries(course.words)) {
    const candidates = [...new Set([word.w, ...Object.keys(word.forms ?? {})].flatMap((f) => bySpelling.get(f) ?? []))];
    if (!candidates.length) continue;
    const gloss = glossWords(word.gloss);
    out.set(id, candidates.find((c) => [...glossWords(c.en)].some((w) => gloss.has(w))) ?? candidates[0]);
  }
  return out;
}

export interface LevelCoverage {
  level: string;
  /** syllabus words at this level */
  words: number;
  /** of those, words the course's lines can say */
  inCourse: number;
  /** of those, words a run used at all */
  used: number;
  /** of those, words a run used at least the target number of times */
  practised: number;
}

export interface SyllabusCoverage {
  levels: LevelCoverage[];
  /** course words with no syllabus word (bonus vocabulary, or a spelling the pack lacks) */
  offSyllabus: WordId[];
  /** syllabus words at the course's first level the course never says, most frequent first */
  missing: SyllabusWord[];
}

export function syllabusCoverage(opts: {
  course: Course;
  syllabus: Syllabus;
  /** words the course's lines can say */
  courseWords: Set<WordId>;
  /** course word -> times a run used it */
  uses: Record<WordId, number>;
  target: number;
}): SyllabusCoverage {
  const { course, syllabus, courseWords, uses, target } = opts;
  const match = matchSyllabus(course, syllabus);
  const inCourse = new Map<string, number>(); // syllabus id -> uses (summed over course words)
  for (const id of courseWords) {
    const s = match.get(id);
    if (s) inCourse.set(s.id, (inCourse.get(s.id) ?? 0) + (uses[id] ?? 0));
  }
  const levels = syllabus.levels.map((level) => {
    const at = syllabus.words.filter((s) => s.lv === level);
    return {
      level,
      words: at.length,
      inCourse: at.filter((s) => inCourse.has(s.id)).length,
      used: at.filter((s) => (inCourse.get(s.id) ?? 0) > 0).length,
      practised: at.filter((s) => (inCourse.get(s.id) ?? 0) >= target).length,
    };
  });
  return {
    levels,
    offSyllabus: [...courseWords].filter((id) => !match.has(id)),
    missing: syllabus.words.filter((s) => s.lv === syllabus.levels[0] && !inCourse.has(s.id)),
  };
}

export interface GrammarCoverage {
  levels: { level: string; points: number; used: number; undetectable: number }[];
  /** grammar point -> lines of the run that used it */
  hits: Record<string, number>;
  /** points with a detector that no line used, in syllabus order */
  unused: GrammarPoint[];
}

export function grammarCoverage(grammar: Grammar, hits: Record<string, number>): GrammarCoverage {
  const levels = [...new Set(grammar.points.map((g) => g.lv))];
  const detectable = (g: GrammarPoint) => Boolean(g.words?.length || g.pattern);
  return {
    levels: levels.map((level) => {
      const at = grammar.points.filter((g) => g.lv === level);
      return { level, points: at.length, used: at.filter((g) => (hits[g.id] ?? 0) > 0).length, undetectable: at.filter((g) => !detectable(g)).length };
    }),
    hits,
    unused: grammar.points.filter((g) => detectable(g) && !(hits[g.id] ?? 0)),
  };
}

/** The language's syllabus and grammar from content/, when it has them. */
export function loadSyllabus(contentDir: string, lang: string): { syllabus?: Syllabus; grammar?: Grammar } {
  const read = <T>(file: string): T | undefined => {
    try {
      return JSON.parse(readFileSync(join(contentDir, "languages", lang, file), "utf8")) as T;
    } catch {
      return undefined;
    }
  };
  return { syllabus: read<Syllabus>("syllabus.json"), grammar: read<Grammar>("grammar.json") };
}

/** JLPT level to CEFR level, the usual rough match. */
const JLPT_LEVELS = [
  { file: "n5.csv", level: "A1" },
  { file: "n4.csv", level: "A2" },
  { file: "n3.csv", level: "B1" },
];

/** HSK 2.0 level to CEFR level, as Hanban matched them. */
const HSK_LEVELS: Record<string, string> = { "1": "A1", "2": "A2", "3": "B1" };

/**
 * npm run import:syllabus -- <lang> <dir>: writes content/languages/<lang>/syllabus.json. <dir> is a
 * vocab pack (pack.json, words.json; for zh its HSK levels become A1/A2/B1) or JLPT word lists
 * (n5.csv, n4.csv, n3.csv: vendor/jlpt).
 */
function main(): void {
  const [lang, dir] = process.argv.slice(2);
  if (!lang || !dir) throw new Error("usage: import:syllabus -- <lang> <dir>, e.g. ko vendor/korean/pack, zh vendor/vocab-engine/packs/zh, ja vendor/jlpt");
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const note = "Generated by npm run import:syllabus; never hand-edit.";
  let syllabus: Syllabus;
  if (existsSync(join(dir, "n5.csv"))) {
    syllabus = buildJlptSyllabus(
      JLPT_LEVELS.map(({ file, level }) => ({ level, csv: readFileSync(join(dir, file), "utf8") })),
      `JLPT N5/N4/N3 word lists as A1/A2/B1: ${dir}. ${note}`,
      "MIT (elzup/jlpt-word-list, from Jonathan Waller's lists at tanos.co.uk). See the folder's README.md and LICENSE.",
    );
  } else {
    const pack = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8"));
    const words = JSON.parse(readFileSync(join(dir, "words.json"), "utf8")) as PackWordJson[];
    const hsk = lang === "zh";
    syllabus = buildSyllabus(
      pack,
      words,
      `${pack.name}: ${dir} (vocab-engine pack "${pack.key}")${hsk ? ", HSK 1/2/3 as A1/A2/B1" : ""}. ${note}`,
      hsk
        ? "Used with the vocab-engine author's consent (the pack's HSK word list)."
        : "CC BY-SA 4.0 (the pack's data licence: glosses from Wiktionary via kaikki.org, frequency from hermitdave/FrequencyWords). See the pack's attribution.json.",
      hsk ? HSK_LEVELS : undefined,
    );
  }
  const out = join(repo, "content", "languages", lang, "syllabus.json");
  writeFileSync(out, JSON.stringify(syllabus, null, 1) + "\n");
  console.log(`${out}: ${syllabus.words.length} words in ${syllabus.levels.join("/")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
