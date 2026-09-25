import { describe, expect, it } from "vitest";
import { comboKey } from "../src/combo";
import { createCore, newGame, type Core } from "../src/core";
import { mentorAvailable } from "../src/mentor";
import { mulberry32 } from "../src/rng";
import { fixtureCourse } from "../src/testing/fixture";
import type { Course, GameEvent } from "../src/types";

const T0 = 1_000_000;

/** The fixture with the cook as mentor after the intro, and two notes. */
function mentorCourse(): Course {
  const c = fixtureCourse();
  c.world.mentor = { npc: "cook", after: "intro" };
  c.notes = [
    { id: "shift-note", trigger: { scene: "shift" } },
    { id: "hao-note", trigger: { word: "w_hao" } },
  ];
  return c;
}

const setup = (c = mentorCourse()): Core => createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
const answerRight = (core: Core) =>
  core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
const ofType = <K extends GameEvent["type"]>(ev: GameEvent[], type: K) =>
  ev.filter((e) => e.type === type) as Extract<GameEvent, { type: K }>[];

describe("mentor", () => {
  it("makes a note ready once, when its word is first heard", () => {
    const core = setup();
    core.send({ type: "goTo", place: "noodle_shop" });
    const start = core.send({ type: "startScene", scene: "intro" });
    expect(ofType(start, "noteReady")).toEqual([{ type: "noteReady", note: "hao-note" }]);
    expect(ofType(answerRight(core), "noteReady")).toEqual([]);
    expect(core.state.notes.ready).toEqual(["hao-note"]);
  });

  it("doesn't count a word looked up but never heard", () => {
    const core = setup();
    expect(core.send({ type: "helpWord", word: "w_hao" }).some((e) => e.type === "noteReady")).toBe(false);
  });

  it("accepts a state from before notes and the log existed", () => {
    const c = mentorCourse();
    const { notes: _n, log: _l, ...old } = newGame(c);
    const core = createCore(c, old as ReturnType<typeof newGame>, { now: () => T0, rng: () => 0 });
    expect(core.send({ type: "goTo", place: "noodle_shop" })).toEqual([{ type: "placeEntered", place: "noodle_shop" }]);
    expect(core.state.log).toHaveLength(1);
  });

  it("is available at the mentor's place once the `after` scene is done", () => {
    const c = mentorCourse();
    const core = setup(c);
    expect(core.send({ type: "visitMentor" })).toEqual([{ type: "inputRejected", reason: "no-mentor" }]);
    core.send({ type: "goTo", place: "noodle_shop" });
    expect(mentorAvailable(c, core.state)).toBe(false);
    core.send({ type: "startScene", scene: "intro" });
    expect(core.send({ type: "visitMentor" })).toEqual([{ type: "inputRejected", reason: "in-scene" }]);
    answerRight(core);
    answerRight(core);
    expect(mentorAvailable(c, core.state)).toBe(true);
    core.send({ type: "goTo", place: "street" });
    expect(mentorAvailable(c, core.state)).toBe(false);
  });

  it("explains the ready notes in course order for one slot, then has nothing new", () => {
    const core = setup();
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    answerRight(core);
    answerRight(core);
    core.send({ type: "startScene", scene: "shift" });
    const done = answerRight(core);
    expect(ofType(done, "noteReady")).toEqual([{ type: "noteReady", note: "shift-note" }]);
    const slot = core.state.slot;
    expect(ofType(core.send({ type: "visitMentor" }), "mentorVisited")).toEqual([
      { type: "mentorVisited", npc: "cook", notes: ["shift-note", "hao-note"] },
    ]);
    expect(core.state.slot).toBe(slot + 1);
    expect(core.state.notes).toEqual({ ready: [], read: ["shift-note", "hao-note"] });
    expect(core.send({ type: "visitMentor" })).toEqual([{ type: "mentorVisited", npc: "cook", notes: [] }]);
  });

  it("needs a free slot, and a course without a mentor has none", () => {
    const c = mentorCourse();
    const core = createCore(c, { ...newGame(c), place: "noodle_shop", scenesDone: { intro: 1 }, slot: 4 }, { now: () => T0, rng: () => 0 });
    expect(core.send({ type: "visitMentor" })).toEqual([{ type: "inputRejected", reason: "no-slots" }]);
    const plain = fixtureCourse();
    const none = createCore(plain, { ...newGame(plain), place: "noodle_shop", scenesDone: { intro: 1 } }, { now: () => T0, rng: () => 0 });
    expect(none.send({ type: "visitMentor" })).toEqual([{ type: "inputRejected", reason: "no-mentor" }]);
  });
});
