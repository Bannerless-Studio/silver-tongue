import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { buildCourse, courseIds } from "../src/build-course";
import { taggingLines, taggingPath } from "../src/tagging";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

describe("taggingLines", () => {
  it("writes each line as its words and the text between them, the name as {name}", () => {
    const c = fixtureCourse();
    const v = Object.values(c.scenes[0].exchanges[0].variants)[0];
    v.npc = { text: `你好${PLAYER_MARK}。`, tokens: [{ start: 0, end: 2, word: Object.keys(c.words)[0] }] };
    expect(taggingLines(c)).toContain(`${c.scenes[0].id}/${c.scenes[0].exchanges[0].id}/npc: 你好|{name}|。`);
  });

  it("puts a name between two words on its own", () => {
    const c = fixtureCourse();
    const v = Object.values(c.scenes[0].exchanges[0].variants)[0];
    const [a, b] = Object.keys(c.words);
    v.reply = { text: `你${PLAYER_MARK}好`, tokens: [{ start: 0, end: 1, word: a }, { start: 2, end: 3, word: b }] };
    expect(taggingLines(c)).toContain(`${c.scenes[0].id}/${c.scenes[0].exchanges[0].id}/reply: 你|{name}|好`);
  });
});

// Only languages with a committed snapshot are checked (content/languages/<code>/tagging.txt).
const snapshots = courseIds(CONTENT).flatMap((id) => {
  const { course } = buildCourse(CONTENT, id);
  const path = course && taggingPath(CONTENT, course.language.code);
  return course && path && existsSync(path) ? [{ id, course, path }] : [];
});
if (snapshots.length)
  describe("committed tagging snapshots", () => {
    for (const { id, course, path } of snapshots) {
      it(`${id}: every line splits as committed (npm run build:course -- ${id} --update-tagging)`, () => {
        expect(taggingLines(course).join("\n") + "\n").toBe(readFileSync(path, "utf8"));
      });
    }
  });
