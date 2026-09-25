import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { makeText } from "@silver-tongue/tui";
import { readFileSync } from "node:fs";
import { serialize } from "@silver-tongue/core";
import { decodeSave, encodeSave, parseFlags, pickAnswer, sessionLines } from "../src/cli";

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
    expect(parseFlags(["--import"])).toMatchObject({ mode: "error" });
    expect(parseFlags(["--export", "--new"])).toMatchObject({ mode: "error" });
  });

  it("round-trips a save through one base64 line, and says why a bad line won't import", () => {
    const course = fixtureCourse();
    const state = { ...newGame(course), day: 6, wallet: 31 };
    const line = encodeSave(state);
    expect(line).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(decodeSave(`  ${line}\n`, course)).toEqual({ ok: true, state });
    expect(decodeSave("not base64!", course)).toEqual({ ok: false, reason: "not-base64" });
    expect(decodeSave(Buffer.from("{").toString("base64"), course)).toEqual({ ok: false, reason: "not-json" });
    const other = Buffer.from(serialize({ ...state, course: "other" })).toString("base64");
    expect(decodeSave(other, course)).toEqual({ ok: false, reason: "other-course" });
  });

  it("refuses unknown flags and --new with --resume", () => {
    expect(parseFlags(["--nwe"])).toEqual({ mode: "error", message: "unknown option --nwe" });
    expect(parseFlags(["--new", "--resume"])).toMatchObject({ mode: "error" });
  });

  it("describes each session in the learner's language", () => {
    const course = fixtureCourse();
    const lines = sessionLines(
      [
        { id: "x", path: "x.json", lastPlayed: 0, state: { ...newGame(course), day: 3, wallet: 47, scenesDone: { intro: 1 } } },
        { id: "y", path: "y.json", lastPlayed: 5, state: { ...newGame(course), place: "noodle_shop", scenesDone: { intro: 1, shift: 4 } } },
      ],
      course,
      makeText(ui + "place-street = The street\nplace-noodle_shop = Noodle shop\n"),
      (ms) => `T${ms}`,
    );
    expect(lines).toEqual([
      "1) Day 3 · The street · ¥47 · 1 scene done · last played T0",
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
});
