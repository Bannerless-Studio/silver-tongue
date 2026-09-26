import { describe, expect, it } from "vitest";
import { createCore, newGame } from "../src/core";
import { parseSave, serialize } from "../src/save";
import { addErrand, fixtureCourse, line } from "../src/testing/fixture";
import { PLAYER_MARK, type GameState } from "../src/types";

describe("save", () => {
  const course = fixtureCourse();
  const bad = (state: unknown) => parseSave(JSON.stringify(state), course);
  const inScene = () => {
    const core = createCore(course, newGame(course), { now: () => 0, rng: () => 0 });
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    return core;
  };

  it("round-trips a game", () => {
    const s = newGame(course);
    expect(parseSave(serialize(s), course)).toEqual({ ok: true, state: s });
  });

  it("round-trips a game in the middle of a scene", () => {
    const core = inScene();
    expect(core.state.run).not.toBeNull();
    expect(parseSave(serialize(core.state), course)).toEqual({ ok: true, state: core.state });
  });

  it("rejects broken or foreign saves with a reason", () => {
    expect(parseSave("{", course)).toEqual({ ok: false, reason: "not-json" });
    expect(parseSave("[]", course)).toEqual({ ok: false, reason: "not-object" });
    const s = newGame(course);
    expect(bad({ ...s, v: 2 })).toEqual({ ok: false, reason: "newer-version" });
    expect(bad({ ...s, v: "1" })).toEqual({ ok: false, reason: "version" });
    expect(bad({ ...s, course: "other" })).toEqual({ ok: false, reason: "other-course" });
    expect(bad({ ...s, place: "moon" })).toEqual({ ok: false, reason: "bad-place" });
    expect(bad({ ...s, words: [] })).toEqual({ ok: false, reason: "bad-words" });
  });

  it("rejects bad values inside the save", () => {
    const s = newGame(course);
    const rec = { right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
    expect(bad({ ...s, day: -1 })).toEqual({ ok: false, reason: "bad-day" });
    expect(bad({ ...s, slot: course.world.slotsPerDay + 1 })).toEqual({ ok: false, reason: "bad-slot" });
    expect(bad({ ...s, wallet: 1.5 })).toEqual({ ok: false, reason: "bad-wallet" });
    expect(bad({ ...s, rentLate: 0 })).toEqual({ ok: false, reason: "bad-rentLate" });
    expect(bad({ ...s, trust: { a: "hi" } })).toEqual({ ok: false, reason: "bad-trust" });
    expect(bad({ ...s, scenesDone: { a: null } })).toEqual({ ok: false, reason: "bad-scenesDone" });
    expect(bad({ ...s, words: { x: 5 } })).toEqual({ ok: false, reason: "bad-words" });
    expect(bad({ ...s, words: { x: { ...rec, lapsed: "no" } } })).toEqual({ ok: false, reason: "bad-words" });
    expect(bad({ ...s, run: { scene: "x" } })).toEqual({ ok: false, reason: "bad-run" });
  });

  it("loads a save from before notes and the log existed, filling them in", () => {
    const { notes: _n, log: _l, ...old } = newGame(course);
    expect(parseSave(JSON.stringify(old), course)).toEqual({ ok: true, state: newGame(course) });
  });

  it("checks notes, the log and first-heard lines when present", () => {
    const s = newGame(course);
    const rec = { right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
    const withFirst = { ...s, words: { w_ni: { ...rec, first: { line: "你好！", place: "street" } } } };
    expect(parseSave(JSON.stringify(withFirst), course)).toMatchObject({ ok: true });
    expect(bad({ ...s, words: { w_ni: { ...rec, first: { line: 1 } } } })).toEqual({ ok: false, reason: "bad-words" });
    expect(bad({ ...s, notes: { ready: "x", read: [] } })).toEqual({ ok: false, reason: "bad-notes" });
    expect(bad({ ...s, log: [{ t: 1 }] })).toEqual({ ok: false, reason: "bad-log" });
    expect(bad({ ...s, notes: null })).toEqual({ ok: false, reason: "bad-notes" });
    expect(bad({ ...s, log: null })).toEqual({ ok: false, reason: "bad-log" });
    expect(bad({ ...s, log: [{ t: 1, day: 1, slot: 0, input: { type: "bogus" } }] })).toEqual({ ok: false, reason: "bad-log" });
    const logged = { ...s, log: [{ t: 1, day: 1, slot: 0, input: { type: "sleep" } }] };
    expect(parseSave(JSON.stringify(logged), course)).toMatchObject({ ok: true });
  });

  it("keeps a pick with written wrong replies, and drops one naming a wrong reply the course no longer has", () => {
    const core = inScene();
    expect(core.state.run!.options.some((k) => k.startsWith("alt:"))).toBe(true);
    expect(parseSave(serialize(core.state), course)).toEqual({ ok: true, state: core.state });
    const stale = { ...core.state, run: { ...core.state.run!, options: ["", "alt:7"] } };
    expect(parseSave(serialize(stale), course)).toMatchObject({ ok: true, state: { run: null } });
  });

  it("drops notes the course no longer has, and duplicates", () => {
    const c = { ...course, notes: [{ id: "a", trigger: { scene: "intro" } }] };
    const res = parseSave(JSON.stringify({ ...newGame(c), notes: { ready: ["a", "a", "gone"], read: ["gone"] } }), c);
    expect(res).toMatchObject({ ok: true, state: { notes: { ready: ["a"], read: [] } } });
  });

  it("drops a scene in progress that the course no longer has", () => {
    const core = inScene();
    const stale: GameState = { ...core.state, run: { ...core.state.run!, scene: "gone" } };
    const res = parseSave(serialize(stale), course);
    expect(res).toEqual({ ok: true, state: { ...stale, run: null } });
  });

  it("gives back the name tile to a reply saved before the name was a tile", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].reply = line(["你", "w_ni"], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null], ["！", null]);
    const core = createCore(c, { ...newGame(c), place: "noodle_shop", player: "Jamil" }, { now: () => 0, rng: () => 0 });
    core.send({ type: "startScene", scene: "intro" });
    // Such a save had only the word tiles.
    const old: GameState = { ...core.state, run: { ...core.state.run!, mode: "tiles", options: [], tiles: ["好", "你"] } };
    const res = parseSave(serialize(old), c);
    expect(res.ok && res.state.run?.tiles).toEqual(["好", "你", PLAYER_MARK]);
  });

  it("drops a tiles run whose reply the saved tiles can no longer build", () => {
    const core = inScene();
    const run = { ...core.state.run!, mode: "tiles" as const, options: [], tiles: ["x"] };
    const stale: GameState = { ...core.state, run };
    expect(parseSave(serialize(stale), course)).toEqual({ ok: true, state: { ...stale, run: null } });
  });

  it("keeps an errand, drops one to a place the course no longer has, and rejects a malformed one", () => {
    const c = addErrand(fixtureCourse());
    const carrying = { ...newGame(c), errand: { to: "school" } };
    expect(parseSave(serialize(carrying), c)).toEqual({ ok: true, state: carrying });
    const gone = parseSave(serialize({ ...newGame(c), errand: { to: "moon" } }), c);
    expect(gone.ok && gone.state.errand).toBeUndefined();
    expect(parseSave(JSON.stringify({ ...newGame(c), errand: "school" }), c)).toEqual({ ok: false, reason: "bad-errand" });
  });

  it("loads a save from before errands with none", () => {
    const old = parseSave(serialize(newGame(course)), course);
    expect(old.ok && old.state.errand).toBeUndefined();
  });

  it("keeps a pickup's destination through a save mid-scene, and drops one that is no longer a place", () => {
    const c = addErrand(fixtureCourse());
    const core = createCore(c, { ...newGame(c), place: "noodle_shop", scenesDone: { intro: 1 } }, { now: () => 0, rng: () => 0 });
    core.send({ type: "startScene", scene: "pickup" });
    expect(core.state.run!.errandTo).toBe("school");
    const kept = parseSave(serialize(core.state), c);
    expect(kept.ok && kept.state.run?.errandTo).toBe("school");
    const moved = parseSave(serialize({ ...core.state, run: { ...core.state.run!, errandTo: "moon" } }), c);
    expect(moved.ok && moved.state.run?.errandTo).toBeUndefined();
  });
});
