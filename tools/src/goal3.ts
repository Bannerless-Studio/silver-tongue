import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAY_MS, type CatalogEntry, type Course } from "@silver-tongue/core";
import { BOTS } from "./bots";
import {
  CHECK_RUN,
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

const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "-");
const ok = (good: boolean) => (good ? "✅" : "⚠️");

/** One course's section of the report, in GitHub Markdown. */
export function goal3Section(c: Goal3Course): string {
  const { course, runs } = c;
  const check = runs[0].report;
  const s = check.syllabus;
  const g = check.grammar;
  const out = [`### ${course.id}`, ``];
  if (s) {
    const levels = s.levels.map((l) => l.level);
    out.push(
      `Syllabus words practised (used ${TARGET_EXPOSURES}+ times in ${check.days} game days), of each level's words:`,
      ``,
      `| bot | ${levels.join(" | ")} |`,
      `|---|${levels.map(() => "---:").join("|")}|`,
      ...runs.map(({ bot, report }) => `| ${bot} | ${report.syllabus!.levels.map((l) => `${l.practised} of ${l.words} (${pct(l.practised, l.words)})`).join(" | ")} |`),
      ``,
      `In the course at all: ${s.levels.map((l) => `${l.level} ${l.inCourse} (${pct(l.inCourse, l.words)})`).join(" · ")}`,
      ``,
    );
  }
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
  const head = [`## Goal 3: finishing reaches A1/A2/B1`, ``, `Learning simulator, ${CHECK_RUN.days} game days, seed ${CHECK_RUN.seed}. Report only: nothing here fails the build.`, ``];
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
      report: learningReport(course, BOTS[bot], { days: CHECK_RUN.days, seed: CHECK_RUN.seed, dayMs: DAY_MS, syllabus, grammar, names }),
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
