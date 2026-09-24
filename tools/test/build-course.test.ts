import { cpSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildCourse } from "../src/build-course";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** Builds a copy of the real content after `change` edits it. */
function buildChanged(change: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "st-content-"));
  temps.push(dir);
  cpSync(CONTENT, dir, { recursive: true });
  change(dir);
  return buildCourse(dir, "zh-china-en");
}

const INTRO = "languages/zh/lines/noodle-intro.ftl";

describe("build-course (real content)", () => {
  const { course, errors } = buildCourse(CONTENT, "zh-china-en");

  it("builds zh-china-en with no errors", () => {
    expect(errors).toEqual([]);
    expect(course!.scenes.map((s) => s.id)).toEqual(["noodle-intro", "noodle-shift"]);
  });

  it("renders every slot combination and tags its words", () => {
    const order = course!.scenes[1].exchanges[1];
    expect(Object.keys(order.variants)).toHaveLength(6);
    const v = order.variants["count=four|item=water"];
    expect(v.npc.text).toBe("四杯水。");
    expect(v.npc.tokens.map((t) => course!.words[t.word].w)).toEqual(["四", "杯", "水"]);
    expect(v.reply.text).toBe("好，四杯水。");
    expect(v.rephrase?.text).toBe("水。四杯。");
  });

  it("resolves concepts, glosses and bonus words", () => {
    expect(course!.concepts.tea.map((id) => course!.words[id].w)).toEqual(["茶"]);
    expect(course!.words.x0001).toMatchObject({ w: "杯", bonus: true, gloss: "cup; glass (measure word for drinks)" });
    expect(course!.words.w0133.gloss).toBe("tea; tea plant");
  });
});

describe("build-course (broken content)", () => {
  it("reports characters that are not in the word list", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, INTRO), "greet = 你好！\ngreet-reply = 喵。\njob = 工作，好吗？\njob-reply = 好。\n"));
    expect(bad.errors).toContain('noodle-intro/greet: "喵。" has characters outside the word list: 喵');
  });

  it("reports a missing reply, a missing lines file and an unknown group", () => {
    const bad = buildChanged((d) => {
      writeFileSync(join(d, INTRO), "greet = 你好！\ngreet-reply = 你好！\njob = 工作，好吗？\n");
      unlinkSync(join(d, "languages/zh/lines/noodle-shift.ftl"));
    });
    expect(bad.errors).toContain('noodle-intro/job: missing message "job-reply"');
    expect(bad.errors.some((e) => e.startsWith("noodle-shift: no zh lines"))).toBe(true);

    const groups = buildChanged((d) => writeFileSync(join(d, "settings/china-city/groups.json"), '{ "groups": {} }'));
    expect(groups.errors.some((e) => /^noodle-shift\/\w+: unknown group/.test(e))).toBe(true);
  });

  it("reports a syntax error in a lines file once, not once per slot combination", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "languages/zh/lines/noodle-shift.ftl"), "order = {\n"));
    expect(bad.errors.filter((e) => e.includes("lines/noodle-shift.ftl"))).toHaveLength(1);
  });

  it("stops with an error, not a crash, when a file everything depends on is broken", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "languages/zh/terms.ftl"), "-tea = {\n"));
    expect(bad.course).toBeUndefined();
    expect(bad.errors[0]).toMatch(/^terms.ftl: terms.ftl: Fluent syntax error/);
  });
});
