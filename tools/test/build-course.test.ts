import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCourse } from "../src/build-course";

const CONTENT = new URL("../../content", import.meta.url).pathname;

describe("build-course (real content)", () => {
  const { course, errors } = buildCourse(CONTENT, "zh-china-en");

  it("builds zh-china-en with no errors", () => {
    expect(errors).toEqual([]);
    expect(course.scenes.map((s) => s.id)).toEqual(["noodle-intro", "noodle-shift"]);
  });

  it("renders every slot combination and tags its words", () => {
    const order = course.scenes[1].exchanges[1];
    expect(Object.keys(order.variants)).toHaveLength(6);
    const v = order.variants["count=four|item=water"];
    expect(v.npc.text).toBe("四杯水。");
    expect(v.npc.tokens.map((t) => course.words[t.word].w)).toEqual(["四", "杯", "水"]);
    expect(v.reply.text).toBe("好，四杯水。");
    expect(v.rephrase?.text).toBe("水。四杯。");
  });

  it("resolves concepts, glosses and bonus words", () => {
    expect(course.concepts.tea.map((id) => course.words[id].w)).toEqual(["茶"]);
    expect(course.words.x0001).toMatchObject({ w: "杯", bonus: true, gloss: "cup; glass (measure word for drinks)" });
    expect(course.words.w0133.gloss).toBe("tea; tea plant");
  });

  it("reports characters that are not in the word list", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-content-"));
    cpSync(CONTENT, dir, { recursive: true });
    writeFileSync(join(dir, "languages/zh/lines/noodle-intro.ftl"), "greet = 你好！\ngreet-reply = 喵。\njob = 工作吗？\njob-reply = 好。\n");
    const bad = buildCourse(dir, "zh-china-en");
    expect(bad.errors).toContain('noodle-intro/greet: "喵。" has characters outside the word list: 喵');
  });
});
