import { describe, expect, it } from "vitest";
import { comboKey } from "../src/combo";
import { describeRun } from "../src/dialogue";
import { createCore, newGame, type Core } from "../src/core";
import { recordRight } from "../src/learner";
import { mulberry32 } from "../src/rng";
import { fixtureCourse } from "../src/testing/fixture";
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
    for (const w of ["w_cha", "w_shui", "w_san", "w_si"]) {
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
});
