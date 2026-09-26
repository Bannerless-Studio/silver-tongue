import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { makeText } from "@silver-tongue/tui";
import { readFileSync } from "node:fs";
import { sessionLines } from "@silver-tongue/tui";
import { parseFlags, pickAnswer } from "../src/cli";

const ui = readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8");

describe("cli", () => {
  it("continues by default, and knows --new, --resume and --help", () => {
    expect(parseFlags([])).toEqual({ mode: "continue" });
    expect(parseFlags(["--new"])).toEqual({ mode: "new" });
    expect(parseFlags(["--resume"])).toEqual({ mode: "resume" });
    expect(parseFlags(["-h"])).toEqual({ mode: "help" });
    expect(parseFlags(["course.json"])).toEqual({ mode: "continue", coursePath: "course.json" });
  });

  it("knows --export and --import <line>", () => {
    expect(parseFlags(["--export"])).toEqual({ mode: "export" });
    expect(parseFlags(["--import", "abc"])).toEqual({ mode: "import", line: "abc" });
    expect(parseFlags(["--import", "-"])).toEqual({ mode: "import", line: "-" });
    expect(parseFlags(["--import"])).toMatchObject({ mode: "error" });
    expect(parseFlags(["--export", "--new"])).toMatchObject({ mode: "error" });
  });

  it("refuses unknown flags and --new with --resume", () => {
    expect(parseFlags(["--nwe"])).toEqual({ mode: "error", message: "unknown option --nwe" });
    expect(parseFlags(["--new", "--resume"])).toMatchObject({ mode: "error" });
  });

  it("describes each session in the learner's language", () => {
    const course = fixtureCourse();
    const lines = sessionLines(
      [
        { lastPlayed: 0, state: { ...newGame(course), day: 3, wallet: 47, scenesDone: { intro: 1 }, player: "Jamil" } },
        { lastPlayed: 5, state: { ...newGame(course), place: "noodle_shop", scenesDone: { intro: 1, shift: 4 } } },
      ],
      course,
      makeText(ui + "place-street = The street\nplace-noodle_shop = Noodle shop\n", "en"),
      (ms) => `T${ms}`,
    );
    expect(lines).toEqual([
      "1) Jamil · Day 3 · The street · ¥47 · 1 scene done · last played T0",
      "2) Day 1 · Noodle shop · ¥20 · 2 scenes done · last played T5",
    ]);
  });

  it("reads the picked number; enter cancels; anything else asks again", () => {
    expect(pickAnswer("2", 3)).toBe(1);
    expect(pickAnswer(" 1 ", 3)).toBe(0);
    expect(pickAnswer("", 3)).toBe("cancel");
    expect(pickAnswer("q", 3)).toBe("cancel");
    expect(pickAnswer("4", 3)).toBe("again");
    expect(pickAnswer("x", 3)).toBe("again");
  });

  it("takes --learn and --read with any mode", () => {
    expect(parseFlags(["--learn", "zh", "--read", "en"])).toEqual({ mode: "continue", learn: "zh", read: "en" });
    expect(parseFlags(["--new", "--learn", "zh-china"])).toEqual({ mode: "new", learn: "zh-china" });
    expect(parseFlags(["--export", "--learn", "zh"])).toEqual({ mode: "export", learn: "zh" });
  });
});
