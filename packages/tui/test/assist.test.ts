import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course, type GameState, type WordRecord } from "@silver-tongue/core";
import { startApp } from "../src/app";
import { FakeTerminal, fixtureWithText } from "./fake-terminal";

const T0 = 1_000_000;
const known = (): WordRecord => ({ right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 });
const fading = (): WordRecord => ({ right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 });
const SHIFT_WORDS = ["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"];

function setup(patch: (s: GameState) => void, change: (c: Course) => void = () => {}, cols = 64, rows = 20) {
  const course = fixtureWithText();
  change(course);
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  const term = new FakeTerminal(cols, rows);
  startApp({ course, core, term, now: () => T0, quit: () => {} });
  return { course, core, term, screen: () => term.screen().join("\n") };
}

/** At the noodle shop after the intro, every word of the shift known, typing on. */
const typingShift = () =>
  setup(
    (s) => {
      s.place = "noodle_shop";
      s.scenesDone = { intro: 1 };
      s.trust = { cook: 2 };
      s.words = Object.fromEntries(SHIFT_WORDS.map((w) => [w, known()]));
    },
    (c) => {
      c.typing = true;
      c.learnerFtl += "\nsetting-type-prompt = Type it in Chinese or pinyin:\n";
    },
  );

const wanted = (g: ReturnType<typeof setup>) => g.course.scenes[1].exchanges[0].variants[comboKey(g.core.state.run!.combo)].reply;

describe("typed replies", () => {
  it("asks for the reply to be typed, with the cursor after the text, and takes it on enter", () => {
    const g = typingShift();
    g.term.press("1");
    expect(g.core.state.run!.mode).toBe("type");
    expect(g.screen()).toContain("Type it in Chinese or pinyin:");
    expect(g.screen()).toContain("[enter] say · [tab] hint");
    g.term.type("hao");
    expect(g.screen()).toMatch(/> hao/);
    expect(g.term.cursor).toEqual({ row: 18, col: 2 + 2 + 3 });
    g.term.press("backspace", "backspace", "backspace");
    // n, w and o are letters here, not the notebook, help or settings.
    g.term.type("now");
    expect(g.screen()).toMatch(/> now/);
    g.term.press("backspace", "backspace", "backspace");
    const reply = wanted(g).text;
    g.term.type(reply);
    g.term.press("return");
    expect(g.screen()).toContain(`You: ${reply}`);
    expect(g.core.state.run).toBeNull();
  });

  it("gives three hints on tab: what the reply does, its words, then the reply itself", () => {
    const g = typingShift();
    g.term.press("1", "tab");
    expect(g.screen()).toMatch(/▸ Hint 1\/3 \(subtle\).*\n.*not a question · 4 words/);
    g.term.press("tab");
    expect(g.screen()).toMatch(/▸ Hint 2\/3 \(stronger\)/);
    expect(g.screen()).toMatch(/Use: /);
    g.term.press("tab");
    expect(g.screen()).toMatch(/▸ Hint 3\/3 \(the reply\)/);
    expect(g.screen()).toContain(wanted(g).text);
    g.term.press("tab");
    expect(g.screen()).toContain("No more hints for this one.");
  });

  it("looks confused when what's typed is only dots", () => {
    const g = typingShift();
    g.term.press("1");
    g.term.type("...");
    g.term.press("return");
    expect(g.screen()).toContain("You: ...");
    expect(g.screen()).toContain("Cook (slower):");
    expect(g.core.state.run!.mode).toBe("pick");
  });

  it("escape looks a word up, and the card closes with escape", () => {
    const g = typingShift();
    g.term.press("1", "escape");
    expect(g.screen()).toContain("Which word?");
    g.term.press("1");
    expect(g.screen()).toMatch(/[茶水]/);
    expect(g.core.state.run!.mode).toBe("type");
  });
});

describe("the job panel", () => {
  it("names the work, its steps and the time left, while working", () => {
    const g = typingShift();
    g.term.press("1");
    expect(g.screen()).toMatch(/Serve drinks  █  · \d+:\d\d left today/);
  });

  it("shows a delivery's steps while carrying a parcel", () => {
    const g = setup((s) => {
      s.scenesDone = { intro: 1 };
      s.errand = { to: "noodle_shop" };
    });
    expect(g.screen()).toContain("Delivery  ✓ Get the parcel ── █ Take it where she said");
  });
});

describe("review", () => {
  const withFading = () =>
    setup((s) => {
      s.scenesDone = { intro: 1 };
      s.words = { w_ni: fading(), w_hao: fading() };
    });

  it("is on the menu while words are fading, and asks each in a line with a gap", () => {
    const g = withFading();
    expect(g.screen()).toMatch(/\d\) Quick review · 2 fading words/);
    const n = g.term.screen().find((l) => l.includes("Quick review"))!.match(/(\d)\) Quick/)![1];
    g.term.press(n);
    const s = g.screen();
    expect(s).toMatch(/^┌ Quick review .* 1\/2 ┐/);
    expect(s).toContain("Fill in the blank:");
    expect(s).toMatch(/_{4,}/);
    expect(s).toContain("Hello!");
    expect(s).toMatch(/\[1\] /);
    expect(s).toMatch(/\[4\] /);
  });

  it("marks the answer, shows the word and its memory, and goes on with enter", () => {
    const g = withFading();
    const n = g.term.screen().find((l) => l.includes("Quick review"))!.match(/(\d)\) Quick/)![1];
    g.term.press(n);
    const item = g.core.state.review!.items[0];
    g.term.press(String(item.options.indexOf(item.word) + 1));
    expect(g.screen()).toContain("✓ Correct!");
    expect(g.screen()).toMatch(/Memory: █░░░░░/);
    expect(g.screen()).toContain("[enter] next");
    g.term.press("return");
    expect(g.screen()).toMatch(/ 2\/2 ┐/);
    const next = g.core.state.review!.items[1];
    g.term.press(String(((next.options.indexOf(next.word) + 1) % 4) + 1));
    expect(g.screen()).toContain("✗ Not quite");
    g.term.press("return");
    expect(g.screen()).toContain("Review done: 1 of 2 right.");
    // The word missed is still fading.
    expect(g.screen()).toContain("Quick review · one fading word");
  });

  it("stops with escape", () => {
    const g = withFading();
    const n = g.term.screen().find((l) => l.includes("Quick review"))!.match(/(\d)\) Quick/)![1];
    g.term.press(n, "escape");
    expect(g.screen()).toContain("Review done: 0 of 2 right.");
    expect(g.core.state.review).toBeUndefined();
  });
});

describe("notebook tabs", () => {
  const afterIntro = () =>
    setup((s) => {
      s.scenesDone = { intro: 1 };
      s.trust = { cook: 2 };
      s.words = { w_ni: known(), w_hao: fading() };
    }, () => {}, 80, 24);

  it("keeps the phrases of conversations had", () => {
    const g = afterIntro();
    g.term.press("n", "2");
    expect(g.screen()).toMatch(/▸ Say hello \(1\)/);
    expect(g.screen()).toContain("你好！");
    expect(g.screen()).toContain("Hello!");
  });

  it("lists the people met, with trust and what you talked about", () => {
    const g = afterIntro();
    g.term.press("n", "3");
    expect(g.screen()).toMatch(/Cook · Noodle shop +██░░░ trust/);
    expect(g.screen()).toContain("Talked about: Say hello");
  });

  it("lists the places known, and where you are", () => {
    const g = afterIntro();
    g.term.press("n", "4");
    expect(g.screen()).toMatch(/The street +◂ you are here/);
    expect(g.screen()).toContain("Steam everywhere.");
  });

  it("shows a new word's label as a badge, and the others by how well they're remembered", () => {
    const g = setup((s) => (s.words = { w_ni: known(), w_hao: { ...fading(), right: 0, lapsed: false } }), () => {}, 80, 24);
    g.term.press("n");
    const badge = g.term.frames.at(-1)!.flat().find((sp) => sp.text === " new ");
    expect(badge).toMatchObject({ inverse: true });
    expect(g.screen()).toMatch(/███░░ safe/);
  });
});
