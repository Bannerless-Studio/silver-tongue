import { describe, expect, it } from "vitest";
import { comboKey } from "../src/combo";
import { createCore, newGame } from "../src/core";
import { tilePieces } from "../src/dialogue";
import { personalize } from "../src/player";
import { mulberry32 } from "../src/rng";
import { fixtureCourse, line } from "../src/testing/fixture";
import { PLAYER_MARK, type GameEvent } from "../src/types";

const T0 = 1_000_000;

describe("player name", () => {
  it("puts the name in place of the mark, shifting the words after it", () => {
    const l = { ...line(["你", "w_ni"], [PLAYER_MARK, null], ["好", "w_hao"]), meaning: `You ${PLAYER_MARK}, hi` };
    const p = personalize(l, "Jamil");
    expect(p.text).toBe("你Jamil好");
    expect(p.tokens.map((t) => p.text.slice(t.start, t.end))).toEqual(["你", "好"]);
    expect(p.meaning).toBe("You Jamil, hi");
    expect(personalize(line(["你", "w_ni"]), "Jamil")).toEqual(line(["你", "w_ni"]));
  });

  it("takes a name, trimmed, and refuses empty, overlong or control-character names", () => {
    const c = fixtureCourse();
    const core = createCore(c, newGame(c), { now: () => T0, rng: () => 0 });
    expect(core.send({ type: "setName", name: "  Jamil " })).toEqual([{ type: "playerNamed", name: "Jamil" }]);
    expect(core.state.player).toBe("Jamil");
    for (const name of ["", "   ", "x".repeat(21), "a\u0007b"]) {
      expect(core.send({ type: "setName", name })).toEqual([{ type: "inputRejected", reason: "bad-name" }]);
    }
  });

  it("needs a name before a scene, when the course's lines use one, and says it in them", () => {
    const c = fixtureCourse();
    c.needsName = true;
    const v = c.scenes[0].exchanges[0].variants[""];
    v.npc = line(["你", "w_ni"], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null], ["！", null]);
    const core = createCore(c, { ...newGame(c), place: "noodle_shop" }, { now: () => T0, rng: mulberry32(1) });
    expect(core.send({ type: "startScene", scene: "intro" })).toEqual([{ type: "inputRejected", reason: "no-name" }]);
    core.send({ type: "setName", name: "Jamil" });
    const ev = core.send({ type: "startScene", scene: "intro" });
    const spoken = ev.find((e) => e.type === "lineSpoken") as Extract<GameEvent, { type: "lineSpoken" }>;
    expect(spoken.line.text).toBe("你好，Jamil！");
    expect(core.state.words.w_ni.first?.line).toBe("你好，Jamil！");
    const opts = ev.find((e) => e.type === "replyOptions")!;
    expect(opts.type === "replyOptions" && opts.mode === "pick" && opts.options.every((o) => !o.text.includes(PLAYER_MARK))).toBe(true);
    core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
  });

  it("makes the player's name a tile, shows it as the name, and accepts it in the reply", () => {
    const c = fixtureCourse();
    c.needsName = true;
    c.scenes[0].exchanges[0].variants[""].reply = line(["你", "w_ni"], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null], ["！", null]);
    // Words that were got wrong once but are known: the reply is built from tiles.
    const lapsed = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const state = { ...newGame(c), place: "noodle_shop", player: "Jamil", words: { w_ni: { ...lapsed }, w_hao: { ...lapsed } } };
    const core = createCore(c, state, { now: () => T0, rng: mulberry32(2) });
    const opts = core.send({ type: "startScene", scene: "intro" }).find((e) => e.type === "replyOptions")!;
    expect(opts.type === "replyOptions" && opts.mode === "tiles" && [...opts.tiles].sort()).toEqual(["Jamil", "你", "好"].sort());
    const run = core.state.run!;
    const order = ["你", "好", PLAYER_MARK].map((p) => run.tiles.indexOf(p));
    const done = core.send({ type: "replyTiles", tiles: order }).find((e) => e.type === "actionPerformed");
    expect(done).toMatchObject({ matched: true, tilesWrong: false });
  });

  it("judges a tile reply by what it shows, so a name that looks like a word still counts", () => {
    const c = fixtureCourse();
    c.needsName = true;
    c.scenes[0].exchanges[0].variants[""].reply = line(["你", "w_ni"], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null], ["！", null]);
    const lapsed = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const state = { ...newGame(c), place: "noodle_shop", player: "你", words: { w_ni: { ...lapsed }, w_hao: { ...lapsed } } };
    const core = createCore(c, state, { now: () => T0, rng: mulberry32(2) });
    core.send({ type: "startScene", scene: "intro" });
    const run = core.state.run!;
    // The name tile first, the word 你 last: on screen that is 你好你, the right answer.
    const order = [PLAYER_MARK, "好", "你"].map((p) => run.tiles.indexOf(p));
    const done = core.send({ type: "replyTiles", tiles: order }).find((e) => e.type === "actionPerformed");
    expect(done).toMatchObject({ matched: true, tilesWrong: false });
  });

  it("puts the name tile where the name is in the line", () => {
    expect(tilePieces(line(["你", "w_ni"], [PLAYER_MARK, null], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null]))).toEqual(["你", PLAYER_MARK, "好", PLAYER_MARK]);
  });

  it("says the name, not the mark, in the notebook line a word was first met in", () => {
    const c = fixtureCourse();
    c.needsName = true;
    c.scenes[0].exchanges[0].variants[""].reply = line(["是", "w_shi"], [PLAYER_MARK, null], ["。", null]);
    const core = createCore(c, { ...newGame(c), place: "noodle_shop", player: "Jamil" }, { now: () => T0, rng: mulberry32(1) });
    core.send({ type: "startScene", scene: "intro" });
    core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
    expect(core.state.words.w_shi.first?.line).toBe("是Jamil。");
  });
});
