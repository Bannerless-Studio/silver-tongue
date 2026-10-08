import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CatalogEntry, type Course } from "@silver-tongue/core";
import { BOTS } from "./bots";
import {
  CHECK_RUN,
  checkRunOptions,
  FAMILIAR_SHARE,
  MAX_NEW_PER_EXCHANGE,
  MIN_FAMILIAR_LINES,
  TARGET_EXPOSURES,
  WINDOW_DAYS,
  learningReport,
  learningWarnings,
  nameWords,
  stageGrammarGaps,
  thinWords,
  type LearningReport,
} from "./learning";
import { loadSyllabus } from "./syllabus";

/**
 * The goal-3 report ("finishing the course reaches A1/A2/B1"): per course with a syllabus, how much of
 * each level the check run teaches, and which of the build's learning limits it meets. It reports and
 * never fails: CI writes it to the job summary and turns each missed limit into a warning.
 */

/** The bots the report runs: the build's check bot, and one that also takes the daily quick review. */
export const GOAL3_BOTS = [CHECK_RUN.bot, "diligent"] as const;

export interface Goal3Course {
  course: Course;
  /** one run per bot in GOAL3_BOTS */
  runs: { bot: string; report: LearningReport }[];
  /** the build's warnings for the check run (learningWarnings) */
  warnings: string[];
  /** the language's name words, which never count as words to learn */
  names: Set<string>;
}

/**
 * When a level counts as finished (gates 1.0): this share of its syllabus words is in the course, this
 * share is practised (TARGET_EXPOSURES+ uses in the check run), and every detectable grammar point of
 * the level is used.
 */
export const LEVEL_PASS = { inCourse: 0.9, practised: 0.7 } as const;

export interface LevelVerdict {
  level: string;
  pass: boolean;
  /** each criterion the level misses, in words */
  missed: string[];
}

/** Pass or fail per syllabus level, judged on one run (the check bot's). */
export function levelVerdicts(r: LearningReport): LevelVerdict[] {
  if (!r.syllabus) return [];
  return r.syllabus.levels.map((l) => {
    const missed: string[] = [];
    if (l.inCourse < LEVEL_PASS.inCourse * l.words) missed.push(`${pct(l.inCourse, l.words)} of words in the course, under ${LEVEL_PASS.inCourse * 100}%`);
    if (l.practised < LEVEL_PASS.practised * l.words) missed.push(`${pct(l.practised, l.words)} practised, under ${LEVEL_PASS.practised * 100}%`);
    const g = r.grammar?.levels.find((x) => x.level === l.level);
    if (g && g.used < g.points - g.undetectable) missed.push(`${g.points - g.undetectable - g.used} detectable grammar point(s) unused`);
    return { level: l.level, pass: !missed.length, missed };
  });
}

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "-");
const ok = (good: boolean) => (good ? "✅" : "⚠️");

/** One course's section of the report, in GitHub Markdown. */
export function goal3Section(c: Goal3Course): string {
  const { course, runs } = c;
  const check = runs[0].report;
  const s = check.syllabus;
  const g = check.grammar;
  const out = [`### ${course.id}`, ``];
  const verdicts = levelVerdicts(check);
  if (verdicts.length)
    out.push(
      `Verdict: ${verdicts.map((v) => `**${v.level} ${v.pass ? "pass ✅" : "not yet ❌"}**`).join(" · ")}`,
      ``,
      ...verdicts.filter((v) => !v.pass).map((v) => `- ${v.level}: ${v.missed.join("; ")}`),
      ``,
    );
  if (s) {
    const levels = s.levels.map((l) => l.level);
    out.push(
      `Syllabus words practised (used ${TARGET_EXPOSURES}+ times in the run), of each level's words:`,
      ``,
      `| bot | ${levels.join(" | ")} |`,
      `|---|${levels.map(() => "---:").join("|")}|`,
      ...runs.map(({ bot, report }) => `| ${bot} | ${report.syllabus!.levels.map((l) => `${l.practised} of ${l.words} (${pct(l.practised, l.words)})`).join(" | ")} |`),
      ``,
      `In the course at all: ${s.levels.map((l) => `${l.level} ${l.inCourse} (${pct(l.inCourse, l.words)})`).join(" · ")}`,
      ``,
    );
  }
  out.push(
    `Per stage (bot "${runs[0].bot}", ${check.days} game days): one-off scenes finished, and the stage's words used ${TARGET_EXPOSURES}+ times:`,
    ``,
    `| stage | scenes | all done by | words practised |`,
    `|---|---:|---:|---:|`,
    ...check.stages.map((st) => `| ${st.stage} | ${st.scenesDone} of ${st.scenes} | ${st.doneDay ? `day ${st.doneDay}` : "-"} | ${st.practised} of ${st.words} (${pct(st.practised, st.words)}) |`),
    ``,
  );
  if (g)
    out.push(
      `Grammar points some line uses: ${g.levels.map((l) => `${l.level} ${l.used} of ${l.points} (${pct(l.used, l.points)})${l.undetectable ? `, ${l.undetectable} not detectable` : ""}`).join(" · ")}`,
      ``,
    );
  const familiar = check.linesAfterOnboarding ? check.familiarAfterOnboarding / check.linesAfterOnboarding : 1;
  const thin = thinWords(check, c.names);
  const gaps = c.warnings.filter((w) => /grammar point/.test(w));
  out.push(
    `| limit (bot "${runs[0].bot}") | target | now | |`,
    `|---|---|---|---|`,
    `| new words per exchange | at most ${MAX_NEW_PER_EXCHANGE} | ${check.heavyBeats.length} exchange(s) over | ${ok(!check.heavyBeats.length)} |`,
    `| familiar lines after onboarding | ${MIN_FAMILIAR_LINES * 100}% (${FAMILIAR_SHARE * 100}%+ words met) | ${pct(check.familiarAfterOnboarding, check.linesAfterOnboarding)} | ${ok(familiar >= MIN_FAMILIAR_LINES)} |`,
    `| uses in the ${WINDOW_DAYS} days after first heard | ${TARGET_EXPOSURES} per word | ${thin.length} word(s) short | ${ok(!thin.length)} |`,
    `| stage words used | all | ${check.unusedStageWords.length} unused | ${ok(!check.unusedStageWords.length)} |`,
    `| grammar due by each stage | all used | ${gaps.length ? `${gaps.length} stage(s) short` : "all used"} | ${ok(!gaps.length)} |`,
    ``,
  );
  return out.join("\n");
}

/** The whole report: a heading, then one section per course. */
export function goal3Markdown(courses: Goal3Course[]): string {
  const head = [`## Goal 3: finishing reaches A1/A2/B1`, ``, `Learning simulator, seed ${CHECK_RUN.seed}: each bot plays until every stage's scenes are done and ${WINDOW_DAYS} more days have passed (at least ${CHECK_RUN.minDays} days, at most ${CHECK_RUN.days}). A level passes when ${LEVEL_PASS.inCourse * 100}% of its words are in the course, ${LEVEL_PASS.practised * 100}% are practised (${TARGET_EXPOSURES}+ uses) and every detectable grammar point of it is used. Report only: nothing here fails the build.`, ``];
  if (!courses.length) return [...head, `No course has a syllabus yet.`].join("\n");
  return [...head, ...courses.map(goal3Section)].join("\n");
}

/** A missed limit as a GitHub Actions warning annotation. */
export function warningAnnotation(courseId: string, warning: string): string {
  const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  return `::warning title=${esc(`goal 3: ${courseId}`).replace(/[:,]/g, "")}::${esc(warning)}`;
}

/** Runs the report on every built course that has a syllabus. */
export function goal3Courses(repo: string): Goal3Course[] {
  const content = join(repo, "content");
  const catalog = JSON.parse(readFileSync(join(repo, "dist", "courses", "index.json"), "utf8")) as CatalogEntry[];
  const out: Goal3Course[] = [];
  for (const entry of catalog) {
    const course = JSON.parse(readFileSync(join(repo, "dist", "courses", entry.id, `${entry.learners[0]}.json`), "utf8")) as Course;
    const lang = course.language.code;
    const { syllabus, grammar } = loadSyllabus(content, lang);
    if (!syllabus) continue;
    const names = nameWords(content, lang);
    const runs = GOAL3_BOTS.map((bot) => ({
      bot,
      report: learningReport(course, BOTS[bot], { ...checkRunOptions(), syllabus, grammar, names }),
    }));
    const warnings = learningWarnings(course, runs[0].report, { names, grammarGaps: grammar ? stageGrammarGaps(course, grammar) : undefined });
    out.push({ course, runs, warnings, names });
  }
  return out;
}

/** npm run report:goal3: the report on stdout; in CI also the job summary and one warning per missed limit. */
function main(): void {
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const courses = goal3Courses(repo);
  const md = goal3Markdown(courses);
  console.log(md);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, md + "\n");
  if (process.env.GITHUB_ACTIONS) for (const c of courses) for (const w of c.warnings) console.log(warningAnnotation(c.course.id, w));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
