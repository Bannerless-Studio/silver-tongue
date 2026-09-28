import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course, type GameState } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { AudioOut, Speech } from "@silver-tongue/view";
import { createQuiet, latestNpcLine, type QuietOptions } from "../src/quiet";

const T0 = 1_000_000;

function setup(patch: (s: GameState) => void = () => {}, change: (c: Course) => void = () => {}, extra: Partial<QuietOptions> = {}) {
  const course = fixtureWithText();
  change(course);
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  let clock = T0;
  const q = createQuiet({ course, core, now: () => (clock += 1000), ...extra });
  return { course, core, q };
}
const rightIndex = (core: ReturnType<typeof setup>["core"]) => core.state.run!.options.indexOf(comboKey(core.state.run!.combo));
const wrongIndex = (core: ReturnType<typeof setup>["core"]) => (rightIndex(core) === 0 ? 1 : 0);
const texts = (q: ReturnType<typeof setup>["q"]) => q.view().backlog.map((b) => b.text ?? b.line?.text);

describe("quiet terminal controller", () => {
  it("a new game opens in the course's own prose and goes straight to the menu", () => {
    const { q } = setup();
    expect(texts(q)).toEqual([
      "You arrive with ¥20 and no words.",
      "An old man on a bench is watching you with open curiosity.",
    ]);
    expect(q.view().phase.kind).toBe("explore");
  });

  it("a game picked up between scenes has no opening prose, just where the player is", () => {
    const { q } = setup((s) => (s.day = 3));
    expect(texts(q)).toEqual(["The street."]);
  });

  it("a game picked up mid-scene shows the NPC's current line and its replies", () => {
    const first = setup();
    first.q.choose(0);
    first.q.choose(0);
    const saved = structuredClone(first.core.state);
    const { q } = setup((s) => Object.assign(s, saved));
    expect(q.view().backlog.map((b) => b.line?.text)).toEqual(["你好！"]);
    expect(q.view().phase.kind).toBe("pick");
  });

  it("everything said lands in the transcript at once; new words are marked; the scene is exposed", () => {
    const { q } = setup();
    q.choose(0); // to the noodle shop
    q.choose(0); // talk to the cook
    const v = q.view();
    expect(v.scene).toBe("intro");
    expect(v.phase.kind).toBe("pick");
    const said = v.backlog.find((b) => b.speaker === "cook")!;
    expect(said.line!.text).toBe("你好！");
    expect(said.fresh).toEqual(["w_ni", "w_hao"]);
  });

  it("a miss costs on the player's own line, not as a money line; the NPC reacts", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    q.choose(rightIndex(core)); // greeting
    const before = q.view().backlog.length;
    q.choose(wrongIndex(core)); // the menu exchange costs 1 on a miss
    const after = q.view().backlog.slice(before);
    expect(after[0]).toMatchObject({ speaker: "player", cost: { amount: -1, reason: "mixup" } });
    expect(after.some((b) => b.tone === "react")).toBe(true);
    expect(after.some((b) => b.text?.includes("mix-up"))).toBe(false);
  });

  it("\"...\" is offered after the replies: the player looks confused and the line is said again", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    const p = q.view().phase;
    if (p.kind !== "pick") throw new Error("expected replies");
    expect(p.confused).toBe(true);
    const before = q.view().backlog.length;
    q.choose(p.options.length);
    const after = q.view().backlog.slice(before);
    expect(after[0]).toMatchObject({ speaker: "player", text: "..." });
    expect(after.some((b) => b.speaker === "cook" && b.line)).toBe(true);
    expect(core.state.run).not.toBeNull();
  });

  it("a second miss gets the line rephrased; a repeat shift is the scene in view", () => {
    const { q, core } = setup((s) => {
      s.scenesDone = { intro: 1 };
      s.trust = { cook: 1 };
      s.wallet = 50;
    });
    q.choose(0);
    q.choose(0);
    expect(q.view().scene).toBe("shift");
    q.choose(wrongIndex(core));
    q.choose(wrongIndex(core));
    expect(q.view().backlog.some((b) => b.rephrase && b.speaker === "cook")).toBe(true);
  });

  it("finishing a scene: earnings once as prose, trust silent, the scene is over", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    while (core.state.run) q.choose(rightIndex(core));
    const all = texts(q).join("\n");
    expect(all).toContain("Done.");
    expect(all).not.toMatch(/trusts you/);
    expect(q.view().scene).toBeUndefined();
  });

  it("sleeping: food is silent, the new day is a line", () => {
    const { q } = setup((s) => ((s.day = 2), (s.slot = 4))); // sleep appears once the day is used up
    const sleep = (q.view().phase as { menu: { kind: string }[] }).menu.findIndex((m) => m.kind === "sleep");
    q.choose(sleep);
    const last = q.view().backlog.at(-1)!;
    expect(last).toMatchObject({ day: 3 });
    expect(texts(q).join("\n")).not.toMatch(/food/);
  });

  it("rent paid on the seventh night is said", () => {
    const { q } = setup((s) => ((s.day = 7), (s.wallet = 100), (s.slot = 4)));
    const sleep = (q.view().phase as { menu: { kind: string }[] }).menu.findIndex((m) => m.kind === "sleep");
    q.choose(sleep);
    expect(texts(q).join("\n")).toContain("-¥50 (rent)");
  });

  it("reveals any line's reading and meaning without logging help", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    const line = q.view().backlog.find((b) => b.speaker === "cook")!.line!;
    const helps = core.state.words.w_ni.helps;
    expect(q.sentence(line)).toMatchObject({ reading: "nǐ hǎo", meaning: "Hello!" });
    expect(q.sentence()).toMatchObject({ meaning: "Hello!" });
    expect(core.state.words.w_ni.helps).toBe(helps);
  });

  it("says everything one input brings in one go, and nothing with sound off", () => {
    const played: Speech[][] = [];
    const audio: AudioOut = { available: true, play: (l) => void played.push(l), stop: () => {} };
    const s = setup(undefined, (c) => {
      for (const sc of c.scenes) for (const ex of sc.exchanges) for (const v of Object.values(ex.variants)) v.npc.audio = ["clip.mp3"];
    }, { audio });
    s.q.choose(0);
    s.q.choose(0);
    expect(played.at(-1)).toEqual([{ clips: ["clip.mp3"] }]);
    s.q.toggleSound();
    const n = played.length;
    s.q.choose(rightIndex(s.core));
    expect(played.length).toBe(n);
  });

  it("a reaction's never-heard words gloss themselves too", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    q.choose(wrongIndex(core)); // the reaction 不是这个 uses words the player has never heard
    const react = q.view().backlog.find((b) => b.tone === "react" && b.line)!;
    expect(react.fresh).toEqual(["w_bu", "w_shi", "w_zhe", "w_ge"]);
  });

  it("a right reply's price rides on the reply, as shopping, not a miss", () => {
    const { q, core } = setup(undefined, (c) => (c.scenes[0].exchanges[0].variants[""].cost = 3));
    q.choose(0);
    q.choose(0);
    q.choose(rightIndex(core));
    expect(q.view().backlog.find((b) => b.speaker === "player")).toMatchObject({ cost: { amount: -3, reason: "shopping" } });
  });

  it("looking up a word sends it as help, and a digit right after still counts", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    const helps = core.state.words.w_ni.helps;
    expect(q.lookUp("w_ni")).toMatchObject({ text: "你" });
    expect(core.state.words.w_ni.helps).toBe(helps + 1);
    const before = q.view().backlog.length;
    q.choose(rightIndex(core));
    expect(q.view().backlog.length).toBeGreaterThan(before);
  });

  it("a new rank is one toast, held until the scene is over", () => {
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };
    const { q, core } = setup((s) => {
      s.words.w_san = { ...known }; // words outside the intro, so its replies stay pick
      s.words.w_si = { ...known };
      s.words.w_ni = { ...known, streak: 2, right: 2 };
    });
    q.choose(0);
    q.choose(0);
    q.choose(rightIndex(core)); // 你 becomes known: 3 of 12 words
    expect(q.view().toasts).toEqual([]);
    for (let i = 0; core.state.run && i < 10; i++) q.choose(rightIndex(core));
    expect(core.state.run).toBeFalsy();
    expect(q.view().toasts.filter((x) => x.text.startsWith("You're now"))).toHaveLength(1);
  });

  it("? targets the newest NPC line, not the player's or narration", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    q.choose(rightIndex(core));
    const b = latestNpcLine(q.view().backlog)!;
    expect(b.speaker).toBe("cook");
    expect(b.line).toEqual(core.state.run && q.view().lastLine);
  });
});
