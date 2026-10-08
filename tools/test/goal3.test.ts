import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCourse } from "../src/build-course";
import { goal3Markdown, goal3Section, warningAnnotation, type Goal3Course } from "../src/goal3";
import { learningReport, learningWarnings, nameWords } from "../src/learning";
import { BOTS } from "../src/bots";
import { loadSyllabus } from "../src/syllabus";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

describe("goal-3 report", () => {
  const { course } = buildCourse(CONTENT, "ko-seoul");
  const { syllabus, grammar } = loadSyllabus(CONTENT, "ko");
  const names = nameWords(CONTENT, "ko");
  const report = learningReport(course!, BOTS.learner, { days: 3, seed: 1, syllabus, grammar, names });
  const c: Goal3Course = { course: course!, runs: [{ bot: "learner", report }], warnings: learningWarnings(course!, report, { names }), names };

  it("a course section has a row per level, a row per bot and every limit", () => {
    const md = goal3Section(c);
    expect(md).toContain("### ko-seoul");
    expect(md).toMatch(/\| bot \| A1 \| A2 \| B1 \|/);
    expect(md).toMatch(/\| learner \| \d+ of \d+/);
    for (const st of report.stages) expect(md).toMatch(new RegExp(`\\| ${st.stage} \\| \\d+ of ${st.scenes} \\|`));
    for (const limit of ["new words per exchange", "familiar lines", "uses in the 7 days", "stage words used", "grammar due"]) expect(md).toContain(limit);
  });

  it("says so when no course has a syllabus", () => {
    expect(goal3Markdown([])).toContain("No course has a syllabus yet.");
  });

  it("a warning annotation is one line, with its title free of the separators Actions reads", () => {
    const a = warningAnnotation("ko-seoul", "57 word(s) short: 다시 1, 천천히 1\nmore");
    expect(a).toBe("::warning title=goal 3 ko-seoul::57 word(s) short: 다시 1, 천천히 1%0Amore");
  });
});
