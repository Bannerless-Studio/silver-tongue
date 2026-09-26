import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course, type GameState } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { AudioOut, Speech } from "@silver-tongue/view";
import { createVn, type VnOptions } from "../src/vn";

const T0 = 1_000_000;
const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };

function setup(patch: (s: GameState) => void = () => {}, change: (c: Course) => void = () => {}, extra: Partial<VnOptions> = {}) {
  const course = fixtureWithText();
  change(course);
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  const saves: GameState[] = [];
  const vn = createVn({ course, core, now: () => T0, save: (s) => saves.push(s) > 0, ...extra });
  return { course, core, vn, saves };
}
/** Taps through every beat. */
const skip = (vn: ReturnType<typeof setup>["vn"]) => {
  while (vn.view().phase.kind === "beat") vn.advance();
};
const rightIndex = (core: ReturnType<typeof setup>["core"]) => core.state.run!.options.indexOf(comboKey(core.state.run!.combo));
/** From a new game: to the noodle shop, into the intro scene, through its opening beats. */
const intoScene = (s: ReturnType<typeof setup>) => {
  skip(s.vn);
  s.vn.choose(0); // go to the noodle shop
  s.vn.choose(0); // talk to the cook
  skip(s.vn);
};

describe("visual novel controller", () => {
  it("tells the story one beat at a time, then offers the place's menu", () => {
    const { vn } = setup();
    expect(vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "You arrive with ¥20 and no words." } });
    vn.advance();
    expect(vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
    vn.advance();
    const p = vn.view().phase;
    expect(p.kind).toBe("explore");
    if (p.kind === "explore") expect(p.menu.map((m) => m.kind)).toEqual(["go", "sleep"]);
    expect(vn.view().place).toBe("street");
  });

  it("starts a scene: the NPC steps on stage, the opening narration, their line, then the replies", () => {
    const { vn } = setup();
    skip(vn);
    vn.choose(0);
    expect(vn.view().place).toBe("noodle_shop");
    vn.choose(0);
    expect(vn.view().npc).toBe("cook");
    expect(vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "The cook looks up from a steaming pot and wipes her hands on her apron." } });
    vn.advance();
    expect(vn.view().phase).toMatchObject({ kind: "beat", beat: { speaker: "cook", line: { text: "你好！" }, cue: "speak" } });
    expect(vn.view().cue).toBe("speak");
    vn.advance();
    expect(vn.view().phase.kind).toBe("pick");
    expect(vn.view().cue).toBe("listen");
    expect(vn.view().lastLine?.text).toBe("你好！");
  });

  it("marks the words heard for the first time", () => {
    const { vn } = setup();
    skip(vn);
    vn.choose(0);
    vn.choose(0);
    vn.advance();
    expect(vn.view().phase).toMatchObject({ kind: "beat", beat: { fresh: ["w_ni", "w_hao"] } });
  });

  it("ignores choices while a beat is showing, and a second tap on the same choice", () => {
    const s = setup();
    skip(s.vn);
    s.vn.choose(0);
    s.vn.choose(0);
    const logged = s.core.state.log.length;
    s.vn.choose(0); // the opening narration is showing
    expect(s.core.state.log.length).toBe(logged);
    skip(s.vn);
    s.vn.choose(rightIndex(s.core));
    s.vn.choose(0); // the player's own line is showing now
    expect(s.core.state.log.length).toBe(logged + 1);
  });

  it("says the player's reply as a beat, then goes on", () => {
    const s = setup();
    intoScene(s);
    s.vn.choose(rightIndex(s.core));
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { speaker: "player", line: { text: "你好！" } } });
    expect(s.core.state.run!.exchange).toBe(1);
  });

  it("a wrong reply gets a puzzled NPC", () => {
    const s = setup();
    intoScene(s);
    s.vn.choose(rightIndex(s.core) === 0 ? 1 : 0);
    const cues: string[] = [];
    while (s.vn.view().phase.kind === "beat") {
      cues.push(s.vn.view().cue);
      s.vn.advance();
    }
    expect(cues).toContain("puzzled");
  });

  it("builds a tiles reply: place, undo, send", () => {
    const s = setup((st) => {
      st.words.w_cha = { ...shaky };
      st.words.w_shui = { ...shaky };
    });
    intoScene(s);
    s.vn.choose(rightIndex(s.core));
    skip(s.vn);
    const p = s.vn.view().phase;
    expect(p.kind).toBe("tiles");
    if (p.kind !== "tiles") return;
    const want = s.core.state.run!.combo.item === "tea" ? "茶" : "水";
    const wrong = p.tiles.findIndex((x) => x !== want);
    s.vn.placeTile(wrong);
    s.vn.placeTile(wrong); // a tile is placed once
    expect(s.vn.view().phase).toMatchObject({ kind: "tiles", placed: [wrong], answer: p.tiles[wrong] });
    s.vn.undoTile();
    s.vn.placeTile(p.tiles.indexOf(want));
    s.vn.sendTiles();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { speaker: "player", line: { text: `${want}？` } } });
  });

  it("looking up a word counts as help and gives its card", () => {
    const s = setup();
    intoScene(s);
    const card = s.vn.lookUp("w_ni");
    expect(card).toMatchObject({ text: "你", gloss: "you" });
    expect(s.core.state.words.w_ni.helps).toBe(1);
    expect(s.vn.view().phase.kind).toBe("pick");
  });

  it("gives the meaning of the line being answered", () => {
    const s = setup();
    intoScene(s);
    expect(s.vn.sentence()).toMatchObject({ text: "你好！", meaning: "Hello!" });
  });

  it("saves after each accepted input, and says once that it can't save", () => {
    const ok = setup();
    skip(ok.vn);
    ok.vn.choose(0);
    expect(ok.saves).toHaveLength(1);
    let tries = 0;
    const blocked = setup(undefined, undefined, { save: () => (tries++, false) });
    skip(blocked.vn);
    blocked.vn.choose(0);
    blocked.vn.choose(0);
    expect(tries).toBe(1);
    expect(blocked.vn.view().toasts.map((x) => x.text)).toEqual([blocked.vn.t("notice-read-only")]);
  });

  it("resumes a scene saved half-way: the NPC's line, not the opening, then the replies", () => {
    const first = setup();
    intoScene(first);
    const saved = first.core.state;
    const again = setup((st) => Object.assign(st, structuredClone(saved)));
    expect(again.vn.view().npc).toBe("cook");
    expect(again.vn.view().phase).toMatchObject({ kind: "beat", beat: { speaker: "cook", line: { text: "你好！" } } });
    again.vn.advance();
    expect(again.vn.view().phase.kind).toBe("pick");
  });

  it("at the end of a scene the NPC leaves after the last beat, and the backlog keeps what was said", () => {
    const s = setup();
    intoScene(s);
    while (s.core.state.run) {
      if (s.vn.view().phase.kind === "pick") s.vn.choose(rightIndex(s.core));
      else s.vn.advance();
    }
    expect(s.vn.view().npc).toBe("cook");
    skip(s.vn);
    expect(s.vn.view().npc).toBeUndefined();
    expect(s.vn.view().phase.kind).toBe("explore");
    expect(s.vn.view().backlog.some((b) => b.text === "She hands you an apron.")).toBe(true);
    expect(s.vn.view().toasts.some((x) => x.tone === "good")).toBe(true); // trust went up
  });

  it("sleeping shows the new day", () => {
    const s = setup();
    skip(s.vn);
    const p = s.vn.view().phase;
    if (p.kind === "explore") s.vn.choose(p.menu.findIndex((m) => m.kind === "sleep"));
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { day: 2 } });
  });

  it("asks for a name first when the course needs one, and refuses a bad one", () => {
    const s = setup(undefined, (c) => (c.needsName = true));
    expect(s.vn.view().phase.kind).toBe("name");
    expect(s.vn.setName("  ")).toBe(false);
    expect(s.vn.view().toasts.at(-1)!.tone).toBe("bad");
    expect(s.vn.setName("Mei")).toBe(true);
    expect(s.core.state.player).toBe("Mei");
    expect(s.vn.view().phase.kind).toBe("beat");
  });

  it("talking to a silhouette starts that NPC's scene", () => {
    const s = setup((st) => (st.place = "noodle_shop"));
    skip(s.vn);
    s.vn.talkTo("cook");
    expect(s.core.state.run?.scene).toBe("intro");
  });

  it("plays each beat's clips as it is shown, and not with sound off", () => {
    const played: Speech[][] = [];
    const audio: AudioOut = { available: true, play: (l) => played.push(l), stop: () => {} };
    const s = setup(undefined, (c) => (c.scenes[0].exchanges[0].variants[""].npc.audio = ["c-hello"]), { audio });
    skip(s.vn);
    s.vn.choose(0);
    s.vn.choose(0);
    s.vn.advance();
    expect(played.at(-1)).toEqual([{ clips: ["c-hello"] }]);
    s.vn.toggleSound();
    expect(s.core.state.sound).toBe(false);
    s.vn.replay();
    expect(played).toHaveLength(1);
  });
});
