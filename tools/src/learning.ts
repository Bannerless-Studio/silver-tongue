import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAY_MS, comboKey, wordState, type CatalogEntry, type Course, type GameState, type RenderedLine, type WordId, type WordState } from "@silver-tongue/core";
import { BOTS, runBot, type Bot } from "./bots";

/**
 * The learning simulator: a bot plays the course through the core, and every line it hears or says
 * is counted per word. It answers whether the course teaches what it claims to: how often each word
 * comes back, in how many places, whether lines stay mostly familiar (design principle 3: about 90%
 * known words) and whether an exchange brings in more than 2 new words.
 */

/** A word should be heard at least this often in a run to stick. */
export const TARGET_EXPOSURES = 8;
/** Design principle 3: each exchange introduces at most this many new words. */
export const MAX_NEW_PER_EXCHANGE = 2;
/** Design principle 3: a line should be about this share familiar. */
export const FAMILIAR_SHARE = 0.9;

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
  /** each word used, with its state to the core at the end of the run */
  words: Record<WordId, WordUse & { state: WordState }>;
  /** NPC lines heard (first time each exchange is played, and every replay) */
  lines: number;
  /** lines whose words were at least FAMILIAR_SHARE used before (heard or said in an earlier beat) */
  linesFamiliar: number;
  /** lines whose words were at least FAMILIAR_SHARE known to the core when heard */
  linesKnown: number;
  /** first plays of an exchange that brought in more than MAX_NEW_PER_EXCHANGE new words */
  heavyBeats: Beat[];
  /** stage words no line ever used */
  unusedStageWords: WordId[];
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

export function learningReport(course: Course, bot: Bot, opts: { days: number; seed: number; dayMs?: number }): LearningReport {
  const uses = new Map<WordId, WordUse & { contextSet: Set<string>; lastUseDay: number }>();
  const used = new Set<WordId>();
  const beatsSeen = new Set<string>();
  const report: LearningReport = {
    course: course.id,
    days: opts.days,
    courseWords: sceneWords(course).size,
    words: {},
    lines: 0,
    linesFamiliar: 0,
    linesKnown: 0,
    heavyBeats: [],
    unusedStageWords: [],
  };

  const use = (word: WordId, day: number, context: string, kind: "heard" | "said") => {
    let u = uses.get(word);
    if (!u) {
      u = { heard: 0, said: 0, contexts: 0, firstDay: day, lastDay: day, maxGapDays: 0, contextSet: new Set(), lastUseDay: day };
      uses.set(word, u);
    }
    u[kind] += 1;
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
  runBot(course, bot, {
    ...opts,
    observe: ({ events, before, after, now }) => {
      end = { state: after, now };
      // A right reply: the player said the words of the exchange they were in.
      if (before.run && events.some((e) => e.type === "actionPerformed" && e.matched)) {
        const context = `${before.run.scene}#${before.run.exchange}`;
        for (const w of wordsOf(variantOf(before).reply)) use(w, before.day, context, "said");
      }
      // Lines heard belong to the exchange the player is in after this input.
      const context = after.run ? `${after.run.scene}#${after.run.exchange}` : lastRun;
      if (after.run) lastRun = context;
      for (const e of events) {
        if (e.type !== "lineSpoken" && e.type !== "lineRephrased" && e.type !== "npcReacted") continue;
        const words = wordsOf(e.line);
        if (e.type === "lineSpoken" && words.length) {
          report.lines += 1;
          const familiar = words.filter((w) => used.has(w)).length / words.length;
          const known = words.filter((w) => wordState(before.words[w], now) === "known").length / words.length;
          if (familiar >= FAMILIAR_SHARE) report.linesFamiliar += 1;
          if (known >= FAMILIAR_SHARE) report.linesKnown += 1;
          // The first time this exchange is played: what it brings in, counting its right reply.
          if (after.run && !beatsSeen.has(context)) {
            beatsSeen.add(context);
            const fresh = [...new Set([...words, ...wordsOf(variantOf(after).reply)])].filter((w) => !used.has(w));
            if (fresh.length > MAX_NEW_PER_EXCHANGE) report.heavyBeats.push({ scene: after.run.scene, exchange: after.run.exchange, newWords: fresh });
          }
        }
        for (const w of words) use(w, after.day, context, "heard");
        for (const w of words) used.add(w);
      }
      // The reply's words count as used once the player has seen the options.
      if (after.run && events.some((e) => e.type === "replyOptions")) for (const w of wordsOf(variantOf(after).reply)) used.add(w);
    },
  });

  for (const [w, u] of uses) {
    const { contextSet, lastUseDay: _, ...rest } = u;
    report.words[w] = { ...rest, contexts: contextSet.size, state: wordState(end?.state.words[w], end?.now ?? 0) };
  }
  report.unusedStageWords = Object.values(course.stageWords)
    .flat()
    .filter((w) => !uses.has(w));
  return report;
}

/** The share as a whole percent. */
const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "-");

export function formatReport(course: Course, r: LearningReport, botName: string): string {
  const entries = Object.entries(r.words);
  const exposures = entries.map(([, u]) => u.heard + u.said).sort((a, b) => a - b);
  const median = exposures.length ? exposures[Math.floor(exposures.length / 2)] : 0;
  const thin = entries.filter(([, u]) => u.heard + u.said < TARGET_EXPOSURES).sort((a, b) => a[1].heard + a[1].said - (b[1].heard + b[1].said));
  const oneContext = entries.filter(([, u]) => u.contexts === 1);
  const label = (w: WordId) => course.words[w]?.w ?? w;
  const lines = [
    `${r.course} · bot "${botName}" · ${r.days} game days`,
    ``,
    `Words: ${entries.length} used of ${r.courseWords} the course can say · median ${median} uses (heard + said)`,
    `  under ${TARGET_EXPOSURES} uses: ${thin.length} (${pct(thin.length, entries.length)})`,
    `  in one exchange only: ${oneContext.length} (${pct(oneContext.length, entries.length)})`,
    `  never said by the player: ${entries.filter(([, u]) => u.said === 0).length}`,
    `  known at the end: ${entries.filter(([, u]) => u.state === "known").length}`,
    `Lines heard: ${r.lines} · ≥${FAMILIAR_SHARE * 100}% familiar: ${pct(r.linesFamiliar, r.lines)} · ≥${FAMILIAR_SHARE * 100}% known: ${pct(r.linesKnown, r.lines)}`,
    `Exchanges bringing in more than ${MAX_NEW_PER_EXCHANGE} new words: ${r.heavyBeats.length}`,
    ...r.heavyBeats.map((b) => `  ${b.scene}#${b.exchange}: ${b.newWords.map(label).join(" ")}`),
    `Stage words never used: ${r.unusedStageWords.length}${r.unusedStageWords.length ? ` (${r.unusedStageWords.map(label).join(" ")})` : ""}`,
    ``,
    `Thinnest words (uses · exchanges · longest gap in days):`,
    ...thin.slice(0, 25).map(([w, u]) => `  ${label(w).padEnd(8)} ${String(u.heard + u.said).padStart(3)} · ${u.contexts} · ${u.maxGapDays}`),
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
  console.log(formatReport(course, learningReport(course, bot, { days, seed: 7, dayMs: DAY_MS }), botName));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
