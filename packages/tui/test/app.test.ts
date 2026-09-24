import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type GameState } from "@silver-tongue/core";
import { startApp } from "../src/app";
import { lineWidth } from "../src/width";
import { FakeTerminal, fixtureWithText } from "./fake-terminal";

const T0 = 1_000_000;

function setup(patch: (s: GameState) => void = () => {}) {
  const course = fixtureWithText();
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  const term = new FakeTerminal();
  const saves: GameState[] = [];
  let quit = false;
  startApp({ course, core, term, now: () => T0, save: (s) => saves.push(s) > 0, quit: () => (quit = true) });
  return { course, core, term, saves, quitted: () => quit };
}

const rightKey = (core: ReturnType<typeof setup>["core"]) =>
  String(core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) + 1);

describe("tui app", () => {
  it("frames every line to the terminal width, CJK included", () => {
    const { term } = setup();
    term.press("1");
    term.press("1");
    for (const line of term.frames.at(-1)!) expect(lineWidth(line)).toBe(64);
    expect(term.frames.at(-1)!.length).toBe(20);
    term.resize(40, 12);
    for (const line of term.frames.at(-1)!) expect(lineWidth(line)).toBe(40);
    expect(term.frames.at(-1)!.length).toBe(12);
  });

  it("starts on the street with a menu and a HUD", () => {
    const { term } = setup();
    const s = term.screen().join("\n");
    expect(s).toContain("The street");
    expect(s).toContain("Day 1 · slot 0/4 · ¥20 · Pidgin");
    expect(s).toContain("1) Go to Noodle shop");
    expect(s).toContain("3) Save and quit");
  });

  it("plays a scene: go, talk, reply, and saves after each accepted input", () => {
    const { term, core, saves } = setup();
    term.press("1");
    expect(term.screen().join("\n")).toContain("Steam everywhere.");
    term.press("1");
    expect(term.screen().join("\n")).toContain("Cook: 你好！");
    term.press(rightKey(core));
    term.press(rightKey(core));
    const s = term.screen().join("\n");
    expect(s).toContain("Cook trusts you a little more (2).");
    expect(s).toContain("New: Serve drinks");
    expect(saves.length).toBe(4);
  });

  it("word help looks up a word from the last line and logs its gloss", () => {
    const { term, core } = setup();
    term.press("1", "1", "w");
    expect(term.screen().join("\n")).toContain("1) 你  2) 好");
    term.press("2");
    expect(term.screen().join("\n")).toContain("好 — good");
    expect(core.state.words.w_hao.helps).toBe(1);
    term.press("escape");
    expect(term.screen().join("\n")).toContain("[1-4] reply");
  });

  it("q quits from the menu", () => {
    const { term, quitted } = setup();
    term.press("q");
    expect(quitted()).toBe(true);
  });

  it("builds a reply from tiles: add, undo, a wrong answer clears the input, then the right one", () => {
    const shaky = { right: 0, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };
    const { term, core } = setup((s) => {
      s.words.w_cha = { ...shaky };
      s.words.w_shui = { ...shaky };
    });
    term.press("1", "1");
    term.press(rightKey(core));
    expect(core.state.run!.mode).toBe("tiles");
    const tiles = core.state.run!.tiles;
    const want = core.state.run!.combo.item === "tea" ? "茶" : "水";
    const right = String(tiles.indexOf(want) + 1);
    const wrong = String(tiles.findIndex((x) => x !== want) + 1);
    term.press(wrong);
    expect(term.screen().join("\n")).toContain(`You say: ${tiles[Number(wrong) - 1]}`);
    term.press("backspace", wrong, "return");
    expect(term.screen().join("\n")).toContain("That's not what they asked for.");
    expect(term.screen().at(-2)).toMatch(/You say: +│$/);
    term.press(right, "return");
    expect(term.screen().join("\n")).toContain("Done. You earned");
  });

  it("a wrong pick shows the reaction, and word help still offers the request", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    const wrong = String(core.state.run!.options.findIndex((k) => k !== comboKey(core.state.run!.combo)) + 1);
    term.press(wrong);
    const s = term.screen().join("\n");
    expect(s).toContain("That's not what they asked for.");
    expect(s).toContain("Cook: 不是这个。");
    term.press("w");
    expect(term.screen().join("\n")).toMatch(/1\) (茶|水)/);
  });

  it("a refused input is explained and not saved", () => {
    const { term, saves } = setup((s) => {
      s.slot = 4;
    });
    term.press("1", "1");
    expect(term.screen().join("\n")).toContain("You're out of time today. Sleep first.");
    expect(saves.length).toBe(1);
  });

  it("sleeping ends the day", () => {
    const { term } = setup();
    term.press("2");
    const s = term.screen().join("\n");
    expect(s).toContain("Day 1 is over. You sleep.");
    expect(s).toContain("Day 2 · slot 0/4");
  });

  it("a save made mid-scene resumes in the scene", () => {
    const first = setup();
    first.term.press("1", "1");
    first.term.press(rightKey(first.core));
    const course = fixtureWithText();
    const core = createCore(course, first.core.state, { now: () => T0, rng: mulberry32(2) });
    const term = new FakeTerminal();
    startApp({ course, core, term, now: () => T0, save: () => true, quit: () => {} });
    expect(term.screen().join("\n")).toMatch(/Cook: (茶|水)。/);
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("Done. You earned");
  });

  it("keeps working on a very short screen", () => {
    const { term } = setup();
    term.resize(30, 8);
    term.press("1");
    expect(term.frames.at(-1)!.length).toBe(8);
    for (const line of term.frames.at(-1)!) expect(lineWidth(line)).toBe(30);
  });

  it("wraps tiles and help words on a narrow screen", () => {
    const { term } = setup();
    term.resize(16, 20);
    term.press("1", "1", "w");
    const s = term.screen();
    expect(s.some((l) => l.includes("1) 你"))).toBe(true);
    expect(s.some((l) => l.includes("2) 好"))).toBe(true);
  });

  it("warns once and stops saving when a save fails", () => {
    const course = fixtureWithText();
    const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
    const term = new FakeTerminal();
    let tries = 0;
    startApp({ course, core, term, now: () => T0, save: () => (tries++, false), quit: () => {} });
    term.press("1", "1");
    const warnings = term.screen().filter((l) => l.includes("can't be saved"));
    expect(warnings).toHaveLength(1);
    expect(tries).toBe(1);
  });
});
