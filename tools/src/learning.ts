import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAY_MS, comboKey, wordState, type CatalogEntry, type Course, type GameState, type RenderedLine, type WordId, type WordState } from "@silver-tongue/core";
import { BOTS, runBot, type Bot } from "./bots";
import {
  grammarCoverage,
  grammarDetector,
  loadSyllabus,
  syllabusCoverage,
  type Grammar,
  type GrammarCoverage,
  type GrammarPoint,
  type Syllabus,
  type SyllabusCoverage,
} from "./syllabus";

/**
 * The learning simulator: a bot plays the course through the core, and every line it hears or says
 * is counted per word. It answers whether the course teaches what it claims to: how often each word
 * comes back, in how many places, whether lines stay mostly familiar (design principle 3: about 90%
 * known words) and whether an exchange brings in more than 2 new words.
 */

/** A word should be used at least this often within WINDOW_DAYS of first being heard, to stick. */
export const TARGET_EXPOSURES = 8;
/** The game days after a word is first heard in which its TARGET_EXPOSURES uses count. */
export const WINDOW_DAYS = 7;
/** Design principle 3: each exchange introduces at most this many new words (names don't count). */
export const MAX_NEW_PER_EXCHANGE = 2;
/** Design principle 3: a line is familiar when at least this share of its words were met before. */
export const FAMILIAR_SHARE = 0.9;
/** At least this share of lines should be familiar, once onboarding is over. */
export const MIN_FAMILIAR_LINES = 0.85;
/**
 * Onboarding ends once this many words are met: before that nothing can be familiar, and the quiet
 * page shows each line's meaning anyway (the 2026-09-29 story spec, section 8).
 */
export const ONBOARDING_WORDS = 10;

export interface WordUse {
  /** times heard in an NPC line, a rephrase or a reaction */
  heard: number;
  /** times said in a right reply */
  said: number;
  /** distinct exchanges (scene#exchange) it was heard or said in */
  contexts: number;
  firstDay: number;
  lastDay: number;
  /** the longest run of game days between two uses */
  maxGapDays: number;
  /** uses within WINDOW_DAYS of firstDay */
  windowUses: number;
}

export interface Beat {
  scene: string;
  exchange: number;
  /** words of the NPC line and the right reply that no earlier beat used */
  newWords: WordId[];
}

export interface LearningReport {
  course: string;
  days: number;
  /** words the course's scenes can use */
  courseWords: number;
  /** quick reviews the bot took (a bot that reviews: see `Bot.reviewRight`) */
  reviews: number;
  /** each word used, with its state to the core at the end of the run */
  words: Record<WordId, WordUse & { state: WordState }>;
  /** NPC lines heard (first time each exchange is played, and every replay) */
  lines: number;
  /** lines whose words were at least FAMILIAR_SHARE used before (heard or said in an earlier beat) */
  linesFamiliar: number;
  /** lines whose words were at least FAMILIAR_SHARE known to the core when heard */
  linesKnown: number;
  /** lines heard once ONBOARDING_WORDS words were met, and how many of those were familiar */
  linesAfterOnboarding: number;
  familiarAfterOnboarding: number;
  /** first plays of an exchange that brought in more than MAX_NEW_PER_EXCHANGE new words */
  heavyBeats: Beat[];
  /** words of the stages the course has scenes for that no line of the run used */
  unusedStageWords: WordId[];
  /** how much of the language's syllabus the run taught, when there is one */
  syllabus?: SyllabusCoverage;
  /** which of the language's grammar points the run's lines used, when it has a grammar list */
  grammar?: GrammarCoverage;
}

/** The words of a line, once each. */
function wordsOf(line: RenderedLine | undefined): WordId[] {
  return line ? [...new Set(line.tokens.map((t) => t.word))] : [];
}

/** Every word the course can say: every variant's lines, and the NPCs' reactions. */
function sceneWords(course: Course): Set<WordId> {
  const out = new Set<WordId>();
  for (const l of Object.values(course.reactions)) wordsOf(l).forEach((w) => out.add(w));
  for (const s of course.scenes)
    for (const ex of s.exchanges)
      for (const v of Object.values(ex.variants)) for (const l of [v.npc, v.reply, v.rephrase, ...(v.alts ?? [])]) wordsOf(l).forEach((w) => out.add(w));
  return out;
}

export function learningReport(
  course: Course,
  bot: Bot,
  opts: { days: number; seed: number; dayMs?: number; syllabus?: Syllabus; grammar?: Grammar; names?: Set<WordId> },
): LearningReport {
  const { syllabus, grammar, names = new Set<WordId>(), ...run } = opts;
  const detect = grammar ? grammarDetector(grammar) : undefined;
  const grammarHits: Record<string, number> = {};
  const hit = (line: RenderedLine) => {
    for (const id of detect?.(line) ?? []) grammarHits[id] = (grammarHits[id] ?? 0) + 1;
  };
  const uses = new Map<WordId, WordUse & { contextSet: Set<string>; lastUseDay: number }>();
  const used = new Set<WordId>();
  const beatsSeen = new Set<string>();
  const report: LearningReport = {
    course: course.id,
    days: opts.days,
    courseWords: 0,
    reviews: 0,
    words: {},
    lines: 0,
    linesFamiliar: 0,
    linesKnown: 0,
    linesAfterOnboarding: 0,
    familiarAfterOnboarding: 0,
    heavyBeats: [],
    unusedStageWords: [],
  };

  const use = (word: WordId, day: number, context: string, kind: "heard" | "said") => {
    let u = uses.get(word);
    if (!u) {
      u = { heard: 0, said: 0, contexts: 0, firstDay: day, lastDay: day, maxGapDays: 0, windowUses: 0, contextSet: new Set(), lastUseDay: day };
      uses.set(word, u);
    }
    u[kind] += 1;
    if (day - u.firstDay < WINDOW_DAYS) u.windowUses += 1;
    u.contextSet.add(context);
    u.maxGapDays = Math.max(u.maxGapDays, day - u.lastUseDay);
    u.lastUseDay = u.lastDay = day;
  };

  const variantOf = (state: GameState) => {
    const run = state.run!;
    const ex = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange];
    return ex.variants[comboKey(run.combo)];
  };

  let lastRun = "";
  let end: { state: GameState; now: number } | undefined;
  report.reviews = runBot(course, bot, {
    ...run,
    observe: ({ events, before, after, now }) => {
      end = { state: after, now };
      // A right reply: the player said the words of the exchange they were in.
      if (before.run && events.some((e) => e.type === "actionPerformed" && e.matched)) {
        const context = `${before.run.scene}#${before.run.exchange}`;
        const reply = variantOf(before).reply;
        for (const w of wordsOf(reply)) use(w, before.day, context, "said");
        hit(reply);
      }
      // Lines heard belong to the exchange the player is in after this input.
      const context = after.run ? `${after.run.scene}#${after.run.exchange}` : lastRun;
      if (after.run) lastRun = context;
      for (const e of events) {
        if (e.type !== "lineSpoken" && e.type !== "lineRephrased" && e.type !== "npcReacted") continue;
        const words = wordsOf(e.line);
        if (e.type === "lineSpoken" && words.length) {
          report.lines += 1;
          hit(e.line);
          // A name heard for the first time hides nothing ("I'm Su-jin"), so names count as met.
          const familiar = words.filter((w) => used.has(w) || names.has(w)).length / words.length;
          const known = words.filter((w) => wordState(before.words[w], now) === "known").length / words.length;
          if (familiar >= FAMILIAR_SHARE) report.linesFamiliar += 1;
          if (known >= FAMILIAR_SHARE) report.linesKnown += 1;
          if ([...used].filter((w) => !names.has(w)).length >= ONBOARDING_WORDS) {
            report.linesAfterOnboarding += 1;
            if (familiar >= FAMILIAR_SHARE) report.familiarAfterOnboarding += 1;
          }
          // The first time this exchange is played: what it brings in, counting its right reply.
          if (after.run && !beatsSeen.has(context)) {
            beatsSeen.add(context);
            const fresh = [...new Set([...words, ...wordsOf(variantOf(after).reply)])].filter((w) => !used.has(w) && !names.has(w));
            if (fresh.length > MAX_NEW_PER_EXCHANGE) report.heavyBeats.push({ scene: after.run.scene, exchange: after.run.exchange, newWords: fresh });
          }
        }
        for (const w of words) use(w, after.day, context, "heard");
        for (const w of words) used.add(w);
      }
      // A review question: the line's other words are heard; the word left out is said when picked right.
      for (const e of events) {
        if (e.type === "reviewAsked") {
          for (const tk of e.line.tokens) if (tk.start !== e.blank.start) use(tk.word, after.day, "review", "heard");
        }
        if (e.type === "reviewAnswered" && e.right) use(e.word, after.day, "review", "said");
      }
      // The reply's words count as used once the player has seen the options.
      if (after.run && events.some((e) => e.type === "replyOptions")) for (const w of wordsOf(variantOf(after).reply)) used.add(w);
    },
  }).reviews;

  for (const [w, u] of uses) {
    const { contextSet, lastUseDay: _, ...rest } = u;
    report.words[w] = { ...rest, contexts: contextSet.size, state: wordState(end?.state.words[w], end?.now ?? 0) };
  }
  const courseWords = sceneWords(course);
  report.courseWords = courseWords.size;
  if (syllabus) {
    const counts = Object.fromEntries(Object.entries(report.words).map(([w, u]) => [w, u.heard + u.said]));
    report.syllabus = syllabusCoverage({ course, syllabus, courseWords, uses: counts, target: TARGET_EXPOSURES });
  }
  if (grammar) report.grammar = grammarCoverage(grammar, grammarHits);
  // Only stages the course has scenes for: a stage still to be written isn't a gap yet.
  const stages = new Set(course.scenes.map((x) => String(x.stage)));
  report.unusedStageWords = Object.entries(course.stageWords)
    .filter(([stage]) => stages.has(stage))
    .flatMap(([, ws]) => ws)
    .filter((w) => !uses.has(w));
  return report;
}

/** Words whose window closed within the run (names left out) but got fewer than TARGET_EXPOSURES uses in it. */
export function thinWords(r: LearningReport, names: Set<WordId> = new Set()): [WordId, WordUse][] {
  return Object.entries(r.words)
    .filter(([w, u]) => !names.has(w) && u.firstDay + WINDOW_DAYS - 1 <= r.days && u.windowUses < TARGET_EXPOSURES)
    .sort((a, b) => a[1].windowUses - b[1].windowUses);
}

export interface StageGrammarGap {
  stage: number;
  /** detectable points due by this stage that no line of this stage or an earlier one uses */
  missing: GrammarPoint[];
}

/** The stage a grammar point is due by: its own `stage`, or its level's (the list's n-th level on stage n). */
export function grammarStage(grammar: Grammar, point: GrammarPoint): number {
  return point.stage ?? [...new Set(grammar.points.map((g) => g.lv))].indexOf(point.lv) + 1;
}

/**
 * Each stage's grammar points (see `grammarStage`) must be used by some line of that stage or an
 * earlier one. Checked on every line the scenes can say, not on a run: a run may not reach a stage's
 * last scenes.
 */
export function stageGrammarGaps(course: Course, grammar: Grammar): StageGrammarGap[] {
  const detect = grammarDetector(grammar);
  const stages = [...new Set(course.scenes.map((s) => s.stage))].sort((a, b) => a - b);
  return stages.flatMap((stage) => {
    const due = grammar.points.filter((g) => grammarStage(grammar, g) === stage && (g.words?.length || g.pattern));
    if (!due.length) return [];
    const used = new Set<string>();
    for (const s of course.scenes.filter((x) => x.stage <= stage))
      for (const ex of s.exchanges) for (const v of Object.values(ex.variants)) for (const l of [v.npc, v.reply]) detect(l).forEach((id) => used.add(id));
    return [{ stage, missing: due.filter((g) => !used.has(g.id)) }];
  });
}

/** The limits a course should meet, as build warnings: one line per limit it misses. */
export function learningWarnings(course: Course, r: LearningReport, opts: { names?: Set<WordId>; grammarGaps?: StageGrammarGap[] } = {}): string[] {
  const label = (w: WordId) => course.words[w]?.w ?? w;
  const some = (xs: string[], n = 8) => xs.slice(0, n).join(", ") + (xs.length > n ? `, … (${xs.length - n} more)` : "");
  const out: string[] = [];
  if (r.heavyBeats.length)
    out.push(`${r.heavyBeats.length} exchange(s) bring in more than ${MAX_NEW_PER_EXCHANGE} new words: ${some(r.heavyBeats.map((b) => `${b.scene}#${b.exchange} (${b.newWords.map(label).join(" ")})`), 5)}`);
  const share = r.linesAfterOnboarding ? r.familiarAfterOnboarding / r.linesAfterOnboarding : 1;
  if (share < MIN_FAMILIAR_LINES)
    out.push(`${pct(r.familiarAfterOnboarding, r.linesAfterOnboarding)} of lines after onboarding are familiar (${FAMILIAR_SHARE * 100}%+ words met), under ${MIN_FAMILIAR_LINES * 100}%`);
  const thin = thinWords(r, opts.names);
  if (thin.length)
    out.push(`${thin.length} word(s) used fewer than ${TARGET_EXPOSURES} times in the ${WINDOW_DAYS} days after first heard: ${some(thin.map(([w, u]) => `${label(w)} ${u.windowUses}`), 12)}`);
  if (r.unusedStageWords.length) out.push(`${r.unusedStageWords.length} stage word(s) no line uses: ${some(r.unusedStageWords.map(label))}`);
  for (const g of opts.grammarGaps ?? [])
    if (g.missing.length) out.push(`stage ${g.stage}: ${g.missing.length} grammar point(s) due by this stage that no line uses: ${some(g.missing.map((p) => `${p.label} (${p.lv})`))}`);
  return out;
}

/** The language's name words (`"name": true` in words.json or extra-words.json). */
export function nameWords(contentDir: string, lang: string): Set<WordId> {
  const out = new Set<WordId>();
  for (const file of ["words.json", "extra-words.json"]) {
    const path = join(contentDir, "languages", lang, file);
    if (!existsSync(path)) continue;
    for (const w of JSON.parse(readFileSync(path, "utf8")) as { id: string; name?: boolean }[]) if (w.name) out.add(w.id);
  }
  return out;
}

/** The run the build checks: the learner bot, two weeks, one game day per real day. */
export const CHECK_RUN = { bot: "learner", days: 14, seed: 7 } as const;

/** Runs the check run on a built course and returns its warnings (see learningWarnings). */
export function learningCheck(contentDir: string, course: Course): string[] {
  const lang = course.language.code;
  const { syllabus, grammar } = loadSyllabus(contentDir, lang);
  const names = nameWords(contentDir, lang);
  const r = learningReport(course, BOTS[CHECK_RUN.bot], { days: CHECK_RUN.days, seed: CHECK_RUN.seed, dayMs: DAY_MS, syllabus, grammar, names });
  return learningWarnings(course, r, { names, grammarGaps: grammar ? stageGrammarGaps(course, grammar) : undefined });
}

/** The share as a whole percent. */
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "-");

function syllabusLines(course: Course, r: LearningReport): string[] {
  const label = (w: WordId) => course.words[w]?.w ?? w;
  const out: string[] = [];
  const s = r.syllabus;
  if (s) {
    out.push(
      ``,
      `Syllabus words (in the course · used · used ${TARGET_EXPOSURES}+ times, of the level's words):`,
      ...s.levels.map((l) => `  ${l.level.padEnd(3)} ${l.inCourse} · ${l.used} · ${l.practised} of ${l.words} (${pct(l.practised, l.words)} practised)`),
      `  course words off the syllabus: ${s.offSyllabus.length}${s.offSyllabus.length ? ` (${s.offSyllabus.map(label).join(" ")})` : ""}`,
      `  most frequent ${s.missing[0]?.lv ?? ""} words the course never says: ${s.missing.slice(0, 20).map((m) => m.w).join(" ")}`,
    );
  }
  const g = r.grammar;
  if (g) {
    out.push(
      ``,
      `Grammar points (used by some line, of the level's points; some can't be spotted by rule):`,
      ...g.levels.map((l) => `  ${l.level.padEnd(3)} ${l.used} of ${l.points}${l.undetectable ? ` (${l.undetectable} not detectable)` : ""}`),
      `  used: ${Object.entries(g.hits).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(" · ") || "none"}`,
      `  first unused: ${g.unused.slice(0, 12).map((p) => `${p.label} (${p.lv})`).join(" · ")}`,
    );
  }
  return out;
}

export function formatReport(course: Course, r: LearningReport, botName: string, names: Set<WordId> = new Set()): string {
  const entries = Object.entries(r.words);
  const exposures = entries.map(([, u]) => u.heard + u.said).sort((a, b) => a - b);
  const median = exposures.length ? exposures[Math.floor(exposures.length / 2)] : 0;
  const thin = thinWords(r, names);
  const oneContext = entries.filter(([, u]) => u.contexts === 1);
  const label = (w: WordId) => course.words[w]?.w ?? w;
  const lines = [
    `${r.course} · bot "${botName}" · ${r.days} game days`,
    ``,
    `Words: ${entries.length} used of ${r.courseWords} the course can say · median ${median} uses (heard + said)`,
    `  under ${TARGET_EXPOSURES} uses in the ${WINDOW_DAYS} days after first heard: ${thin.length} (${pct(thin.length, entries.length)})`,
    `  in one exchange only: ${oneContext.length} (${pct(oneContext.length, entries.length)})`,
    `  never said by the player: ${entries.filter(([, u]) => u.said === 0).length}`,
    `  known at the end: ${entries.filter(([, u]) => u.state === "known").length}`,
    `Lines heard: ${r.lines} · ≥${FAMILIAR_SHARE * 100}% familiar: ${pct(r.linesFamiliar, r.lines)} (after onboarding: ${pct(r.familiarAfterOnboarding, r.linesAfterOnboarding)} of ${r.linesAfterOnboarding}) · ≥${FAMILIAR_SHARE * 100}% known: ${pct(r.linesKnown, r.lines)}`,
    ...(r.reviews ? [`Quick reviews taken: ${r.reviews}`] : []),
    `Exchanges bringing in more than ${MAX_NEW_PER_EXCHANGE} new words (names don't count): ${r.heavyBeats.length}`,
    ...r.heavyBeats.map((b) => `  ${b.scene}#${b.exchange}: ${b.newWords.map(label).join(" ")}`),
    `Stage words never used: ${r.unusedStageWords.length}${r.unusedStageWords.length ? ` (${r.unusedStageWords.map(label).join(" ")})` : ""}`,
    ...syllabusLines(course, r),
    ``,
    `Thinnest words (uses in the first ${WINDOW_DAYS} days · all uses · exchanges · longest gap in days):`,
    ...thin.slice(0, 25).map(([w, u]) => `  ${label(w).padEnd(8)} ${String(u.windowUses).padStart(3)} · ${u.heard + u.said} · ${u.contexts} · ${u.maxGapDays}`),
  ];
  return lines.join("\n");
}

function main(): void {
  const courseId = process.argv[2] ?? "ko-seoul";
  const days = Number(process.argv[3] ?? 14);
  const botName = process.argv[4] ?? "learner";
  const bot = BOTS[botName];
  if (!bot) throw new Error(`no bot "${botName}"; one of: ${Object.keys(BOTS).join(", ")}`);
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const catalog = JSON.parse(readFileSync(join(repo, "dist", "courses", "index.json"), "utf8")) as CatalogEntry[];
  const learner = catalog.find((e) => e.id === courseId)?.learners[0];
  if (!learner) throw new Error(`no course "${courseId}" in dist/courses/index.json; run npm run build:course`);
  const course = JSON.parse(readFileSync(join(repo, "dist", "courses", courseId, `${learner}.json`), "utf8")) as Course;
  const content = join(repo, "content");
  const { syllabus, grammar } = loadSyllabus(content, course.language.code);
  const names = nameWords(content, course.language.code);
  const r = learningReport(course, bot, { days, seed: 7, dayMs: DAY_MS, syllabus, grammar, names });
  console.log(formatReport(course, r, botName, names));
  const warnings = learningWarnings(course, r, { names, grammarGaps: grammar ? stageGrammarGaps(course, grammar) : undefined });
  if (warnings.length) console.log(`\nLimits missed:\n${warnings.map((w) => `  ! ${w}`).join("\n")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
