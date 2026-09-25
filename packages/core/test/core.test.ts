import { describe, expect, it } from "vitest";
import { comboKey } from "../src/combo";
import { describeRun } from "../src/dialogue";
import { createCore, LOG_LIMIT, newGame, type Core } from "../src/core";
import { recordRight } from "../src/learner";
import { mulberry32 } from "../src/rng";
import { fixtureCourse, line } from "../src/testing/fixture";
import type { GameEvent, WordRecord } from "../src/types";

const T0 = 1_000_000;
const course = fixtureCourse();

const setup = (seed = 1): Core => createCore(course, newGame(course), { now: () => T0, rng: mulberry32(seed) });
const types = (ev: GameEvent[]) => ev.map((e) => e.type);
const find = <K extends GameEvent["type"]>(ev: GameEvent[], type: K) =>
  ev.find((e) => e.type === type) as Extract<GameEvent, { type: K }>;

/** Index of the right option in the current pick. */
const rightChoice = (core: Core) => core.state.run!.options.indexOf(comboKey(core.state.run!.combo));
const answerRight = (core: Core) => core.send({ type: "reply", choice: rightChoice(core) });

function playIntro(core: Core) {
  core.send({ type: "goTo", place: "noodle_shop" });
  core.send({ type: "startScene", scene: "intro" });
  answerRight(core);
  return answerRight(core);
}

describe("core", () => {
  it("moves between linked places only", () => {
    const core = setup();
    expect(core.send({ type: "goTo", place: "nowhere" })).toEqual([{ type: "inputRejected", reason: "not-linked" }]);
    expect(core.send({ type: "goTo", place: "noodle_shop" })).toEqual([{ type: "placeEntered", place: "noodle_shop" }]);
    expect(core.state.place).toBe("noodle_shop");
  });

  it("a rejected input leaves the state untouched", () => {
    const core = setup();
    const before = core.state;
    core.send({ type: "startScene", scene: "intro" });
    expect(core.state).toBe(before);
  });

  it("plays the intro: line, options, next exchange, then trust and an unlock", () => {
    const core = setup();
    core.send({ type: "goTo", place: "noodle_shop" });
    const start = core.send({ type: "startScene", scene: "intro" });
    expect(types(start)).toEqual(["sceneStarted", "lineSpoken", "wordStateChanged", "wordStateChanged", "replyOptions"]);
    expect(find(start, "replyOptions")).toMatchObject({ mode: "pick" });
    expect(core.state.slot).toBe(1);

    const next = answerRight(core);
    expect(types(next)).toEqual(["actionPerformed", "lineSpoken", "wordStateChanged", "replyOptions"]);

    const end = answerRight(core);
    expect(types(end)).toEqual(["actionPerformed", "sceneEnded", "trustChanged", "unlocked"]);
    expect(find(end, "trustChanged")).toEqual({ type: "trustChanged", npc: "cook", trust: 2 });
    expect(find(end, "unlocked")).toEqual({ type: "unlocked", scene: "shift" });
    expect(core.state.run).toBeNull();
  });

  it("a wrong reply costs money, triggers a reaction, and rephrases after two misses", () => {
    const core = setup();
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const right = rightChoice(core);
    const wrong = right === 0 ? 1 : 0;

    const miss1 = core.send({ type: "reply", choice: wrong });
    expect(find(miss1, "actionPerformed").matched).toBe(false);
    expect(find(miss1, "walletChanged")).toMatchObject({ delta: -2, reason: "mixup" });
    expect(find(miss1, "npcReacted")).toMatchObject({ npc: "cook", reaction: "wrong-generic" });
    expect(types(miss1)).not.toContain("lineRephrased");

    const miss2 = core.send({ type: "reply", choice: wrong });
    expect(find(miss2, "lineRephrased")).toMatchObject({ npc: "cook", slow: false });

    const ok = core.send({ type: "reply", choice: right });
    expect(find(ok, "sceneEnded")).toEqual({ type: "sceneEnded", scene: "shift", earned: 3 });
    expect(find(ok, "trustChanged")).toMatchObject({ trust: 3 });
    expect(core.state.wallet).toBe(20 - 4 + 3);
  });

  it("switches to tiles when the hinge words are known but typing is off", () => {
    const core = setup();
    playIntro(core);
    const words: Record<string, WordRecord> = {};
    for (const w of ["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"]) {
      words[w] = recordRight(recordRight(recordRight(undefined, T0), T0), T0);
    }
    const tiles = createCore(course, { ...core.state, words }, { now: () => T0, rng: mulberry32(2) });
    const ev = tiles.send({ type: "startScene", scene: "shift" });
    expect(find(ev, "replyOptions").mode).toBe("tiles");

    const run = tiles.state.run!;
    const reply = course.scenes[1].exchanges[0].variants[comboKey(run.combo)].reply;
    const order = reply.tokens.map((t) => run.tiles.indexOf(reply.text.slice(t.start, t.end)));
    const done = tiles.send({ type: "replyTiles", tiles: order });
    expect(find(done, "actionPerformed").matched).toBe(true);

    const bad = createCore(course, { ...core.state, words }, { now: () => T0, rng: mulberry32(2) });
    bad.send({ type: "startScene", scene: "shift" });
    expect(find(bad.send({ type: "replyTiles", tiles: [0] }), "actionPerformed").matched).toBe(false);
  });

  it("only slots that change the action count as a mix-up", () => {
    const c = fixtureCourse();
    c.scenes[1].exchanges[0].expect = { action: "serve", item: "$item" };
    c.scenes[1].exchanges[0].hinges = ["$item"];
    const core = createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const run = core.state.run!;
    const sameItem = run.options.findIndex((k) => k !== comboKey(run.combo) && k.endsWith(`item=${run.combo.item}`));
    expect(sameItem).toBeGreaterThanOrEqual(0);
    expect(find(core.send({ type: "reply", choice: sameItem }), "actionPerformed").matched).toBe(true);
  });

  it("rejects a resumed scene that no longer fits the course instead of throwing", () => {
    const core = setup();
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const stale = createCore(course, { ...core.state, run: { ...core.state.run!, exchange: 5 } }, { now: () => T0, rng: mulberry32(1) });
    expect(stale.send({ type: "reply", choice: 0 })).toEqual([{ type: "inputRejected", reason: "stale-run" }]);
  });

  it("describes the scene in progress for a front end resuming a save, without changing it", () => {
    const core = setup();
    expect(describeRun(course, core.state)).toEqual([]);
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    const next = answerRight(core);
    const before = core.state;
    expect(describeRun(course, core.state)).toEqual([
      { type: "sceneStarted", scene: "intro", npc: "cook" },
      find(next, "lineSpoken"),
      find(next, "replyOptions"),
    ]);
    expect(core.state).toBe(before);
  });

  it("a help lookup makes a word shaky", () => {
    const core = setup();
    playIntro(core);
    expect(core.send({ type: "helpWord", word: "w_ni" })).toEqual([
      { type: "wordStateChanged", word: "w_ni", from: "met", to: "shaky" },
    ]);
  });

  it("sleeps only at home when the course has one", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    const core = createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
    core.send({ type: "goTo", place: "noodle_shop" });
    const before = core.state;
    expect(core.send({ type: "sleep" })).toEqual([{ type: "inputRejected", reason: "not-home" }]);
    expect(core.state).toBe(before);
    core.send({ type: "goTo", place: "street" });
    expect(types(core.send({ type: "sleep" }))).toContain("dayEnded");
    expect(core.state.day).toBe(2);
  });

  it("keeps a running scene going after the course adds to its `after`", () => {
    const core = setup();
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const c = fixtureCourse();
    c.scenes[1].after = ["intro", "later"];
    const resumed = createCore(c, core.state, { now: () => T0, rng: mulberry32(1) });
    const choice = resumed.state.run!.options.indexOf(comboKey(resumed.state.run!.combo));
    expect(types(resumed.send({ type: "reply", choice }))).not.toContain("inputRejected");
  });

  it("uses day slots and refuses scenes when they run out", () => {
    const core = setup();
    playIntro(core);
    for (let i = 0; i < 3; i++) {
      core.send({ type: "startScene", scene: "shift" });
      answerRight(core);
    }
    expect(core.state.slot).toBe(4);
    expect(core.send({ type: "startScene", scene: "shift" })).toEqual([{ type: "inputRejected", reason: "no-slots" }]);
    expect(types(core.send({ type: "sleep" }))).toContain("dayEnded");
    expect(core.state.slot).toBe(0);
  });

  it("says what was asked alongside what the reply did", () => {
    const core = setup();
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const { combo, options } = core.state.run!;
    const expected = { action: "serve", item: combo.item, count: combo.count };
    const wrongKey = options.find((k) => k !== comboKey(combo))!;
    const miss = find(core.send({ type: "reply", choice: options.indexOf(wrongKey) }), "actionPerformed");
    expect(miss.expected).toEqual(expected);
    expect(miss.action).not.toEqual(expected);
    expect(find(answerRight(core), "actionPerformed")).toMatchObject({ matched: true, action: expected, expected });
  });

  it("remembers the line and place where each word was first heard, and never overwrites it", () => {
    const core = setup();
    playIntro(core);
    expect(core.state.words.w_ni.first).toEqual({ line: "你好！", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "shift" });
    expect(core.state.words.w_ni.first).toEqual({ line: "你好！", place: "noodle_shop" });
    const bei = core.state.words.x_bei.first!;
    expect(bei.line).toMatch(/杯/);
  });

  it("logs accepted inputs for play-tests, not rejected ones, keeping the last 500", () => {
    const core = setup();
    core.send({ type: "goTo", place: "nowhere" });
    core.send({ type: "goTo", place: "noodle_shop" });
    expect(core.state.log).toEqual([{ t: T0, day: 1, slot: 0, input: { type: "goTo", place: "noodle_shop" } }]);
    for (let i = 0; i < 600; i++) core.send({ type: "helpWord", word: "w_ni" });
    expect(core.state.log).toHaveLength(LOG_LIMIT);
    expect(core.state.log.at(-1)!.input).toEqual({ type: "helpWord", word: "w_ni" });
  });

  it("keeps picking for a word got wrong but never right: tiles are for words once known", () => {
    const core = setup();
    playIntro(core);
    const wrongOnly = { right: 0, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const words = Object.fromEntries(["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"].map((w) => [w, { ...wrongOnly }]));
    const pick = createCore(course, { ...core.state, words }, { now: () => T0, rng: mulberry32(2) });
    expect(find(pick.send({ type: "startScene", scene: "shift" }), "replyOptions").mode).toBe("pick");
    const lapsed = Object.fromEntries(Object.keys(words).map((w) => [w, { ...wrongOnly, right: 1 }]));
    const tiles = createCore(course, { ...core.state, words: lapsed }, { now: () => T0, rng: mulberry32(2) });
    expect(find(tiles.send({ type: "startScene", scene: "shift" }), "replyOptions").mode).toBe("tiles");
  });

  it("falls back to picking after two wrong tile answers", () => {
    const core = setup();
    playIntro(core);
    const lapsed = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const words = Object.fromEntries(["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"].map((w) => [w, { ...lapsed }]));
    const tiles = createCore(course, { ...core.state, words }, { now: () => T0, rng: mulberry32(2) });
    tiles.send({ type: "startScene", scene: "shift" });
    expect(find(tiles.send({ type: "replyTiles", tiles: [0] }), "replyOptions").mode).toBe("tiles");
    const second = tiles.send({ type: "replyTiles", tiles: [0] });
    expect(find(second, "replyOptions").mode).toBe("pick");
    expect(tiles.state.run!.mode).toBe("pick");
    expect(tiles.state.run!.options).toContain(comboKey(tiles.state.run!.combo));
    expect(find(answerRight(tiles), "actionPerformed").matched).toBe(true);
  });

  it("offers written wrong replies for an exchange without slots, and picking one is a mix-up", () => {
    const core = setup();
    core.send({ type: "goTo", place: "noodle_shop" });
    const start = core.send({ type: "startScene", scene: "intro" });
    const opts = find(start, "replyOptions");
    expect(opts.mode === "pick" && opts.options.map((o) => o.text).sort()).toEqual(["你好！", "好你！", "好！"].sort());
    const run = core.state.run!;
    const alt = run.options.findIndex((k) => k.startsWith("alt:"));
    const miss = core.send({ type: "reply", choice: alt });
    expect(find(miss, "actionPerformed")).toMatchObject({ matched: false, action: { action: "other" }, expected: { action: "greet" } });
    expect(find(miss, "npcReacted")).toBeTruthy();
    expect(find(answerRight(core), "actionPerformed").matched).toBe(true);
  });

  it("counts the words of a right reply as answered right, and remembers the reply they were first said in", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].reply = line(["不", "w_bu"], ["是", "w_shi"], ["。", null]);
    const core = createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    answerRight(core);
    expect(core.state.words.w_bu).toMatchObject({ right: 1, first: { line: "不是。", place: "noodle_shop" } });
  });

  it("chooses the reply mode by the weakest of the hinge and reply words", () => {
    const core = setup();
    const lapsed = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const words = { w_ni: { ...lapsed }, w_hao: { ...lapsed } };
    const tiles = createCore(course, { ...core.state, place: "noodle_shop", words }, { now: () => T0, rng: mulberry32(2) });
    expect(find(tiles.send({ type: "startScene", scene: "intro" }), "replyOptions").mode).toBe("tiles");
    expect([...tiles.state.run!.tiles].sort()).toEqual(["你", "好"].sort()); // the wrong replies add no new words here
  });

  it("a mix-up weakens the right reply's words that the chosen reply lacked", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].alts = [line(["好", "w_hao"], ["！", null])];
    const core = createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    const alt = core.state.run!.options.indexOf("alt:0");
    core.send({ type: "reply", choice: alt });
    expect(core.state.words.w_ni).toMatchObject({ wrong: 1, lapsed: true }); // 你 was missing from 好！
    expect(core.state.words.w_hao.wrong).toBe(0); // 好 was in both
  });

  it("resumes a saved pick that includes written wrong replies", () => {
    const core = setup();
    core.send({ type: "goTo", place: "noodle_shop" });
    const start = core.send({ type: "startScene", scene: "intro" });
    expect(describeRun(course, core.state)).toContainEqual(find(start, "replyOptions"));
  });
});

