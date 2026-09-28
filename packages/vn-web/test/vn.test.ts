import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course, type GameState } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { AudioOut, Speech } from "@silver-tongue/view";
import { createVn, type VnOptions } from "../src/vn";
import { dwellMs } from "../src/dwell";

const T0 = 1_000_000;
const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };

function setup(patch: (s: GameState) => void = () => {}, change: (c: Course) => void = () => {}, extra: Partial<VnOptions> = {}) {
  const course = fixtureWithText();
  change(course);
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  const saves: GameState[] = [];
  let clock = T0;
  const vn = createVn({ course, core, now: () => (clock += 1000), save: (s) => saves.push(s) > 0, ...extra });
  return { course, core, vn, saves };
}
/** Taps through every beat. */
const skip = (vn: ReturnType<typeof setup>["vn"]) => {
  while (vn.view().phase.kind === "beat") vn.advance();
};
/** Timers the test fires by hand; a cancelled one does nothing, like clearTimeout. */
function clock() {
  const pending: { ms: number; fire: () => void; cancelled: boolean }[] = [];
  const wait = (ms: number, cb: () => void) => {
    const w = { ms, fire: () => !w.cancelled && cb(), cancelled: false };
    pending.push(w);
    return { cancel: () => void (w.cancelled = true) };
  };
  return { pending, wait, last: () => pending.at(-1)! };
}
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
    if (p.kind === "explore") expect(p.menu.map((m) => m.kind)).toEqual(["go"]); // no sleep: the day has only begun
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
    const s = setup((st) => (st.slot = 4));
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

  it("a second tap right after moving on does nothing on the new screen", () => {
    let t = T0;
    const s = setup(undefined, undefined, { now: () => t });
    skip(s.vn);
    t += 1000;
    s.vn.choose(0); // go to the noodle shop
    s.vn.choose(0); // the same tap again, now over "talk to the cook"
    s.vn.talkTo("cook");
    expect(s.core.state.place).toBe("noodle_shop");
    expect(s.core.state.run).toBeNull();
    t += 1000;
    s.vn.choose(0);
    expect(s.core.state.run?.scene).toBe("intro");
  });

  it("the tap that closes the new day does not also start a scene", () => {
    let t = T0;
    const s = setup((st) => Object.assign(st, { place: "noodle_shop", slot: 4 }), undefined, { now: () => t });
    skip(s.vn);
    t += 1000;
    const p = s.vn.view().phase;
    if (p.kind === "explore") s.vn.choose(p.menu.findIndex((m) => m.kind === "sleep"));
    skip(s.vn); // the last tap closes "Day 2"
    s.vn.talkTo("cook");
    expect(s.core.state.run).toBeNull();
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

  it("moves on by itself once the line has had its reading time", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    const p = s.vn.view().phase;
    expect(p.kind).toBe("beat");
    if (p.kind !== "beat") return;
    expect(c.pending).toHaveLength(1);
    expect(c.pending[0].ms).toBe(dwellMs(p.beat));
    c.pending[0].fire(); // the reading time is up
    expect(c.last().ms).toBe(200); // then a short pad before the next beat
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("stays until the clip has finished, then 200ms", () => {
    const c = clock();
    let busy = true;
    const audio = { available: true, get busy() { return busy; }, play: () => {}, stop: () => {} };
    const s = setup(undefined, undefined, { wait: c.wait, audio });
    c.pending[0].fire(); // the reading time is up, the clip is still going
    expect(s.vn.view().phase.kind).toBe("beat");
    expect(c.last().ms).toBe(200);
    busy = false;
    c.last().fire();
    expect(c.last().ms).toBe(200); // the pad after the sound
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("a clip started during the pad is not cut off", () => {
    const c = clock();
    let busy = false;
    const audio = { available: true, get busy() { return busy; }, play: () => {}, stop: () => {} };
    const s = setup(undefined, undefined, { wait: c.wait, audio });
    c.pending[0].fire(); // the reading time is up, nothing is playing
    expect(c.last().ms).toBe(200);
    busy = true; // the player asks for the line again in the pad
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "You arrive with ¥20 and no words." } });
    expect(c.last().ms).toBe(200); // still waiting for the clip
    busy = false;
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("waits while an overlay is open, and gives the line its time again after", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    s.vn.hold(true);
    expect(c.pending).toHaveLength(1); // the one armed while the first beat was shown
    c.pending[0].fire(); // cancelled: the line stays
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "You arrive with ¥20 and no words." } });
    s.vn.setAuto(true); // the settings panel asks again, over the overlay
    expect(c.pending).toHaveLength(1); // an overlay open, nothing armed
    s.vn.hold(false);
    expect(c.pending).toHaveLength(2);
    c.last().fire(); // the reading time again, not what was left of it
    c.last().fire(); // then the pad
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("waits for a press on the day card", () => {
    const c = clock();
    const s = setup((st) => (st.slot = 4), undefined, { wait: c.wait });
    skip(s.vn);
    const p = s.vn.view().phase;
    if (p.kind === "explore") s.vn.choose(p.menu.findIndex((m) => m.kind === "sleep"));
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { day: 2 } });
    // The opening beats tapped through above each armed a timer, and `cancel` only marks an entry
    // cancelled: what must be true is that the day card left no live timer behind.
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(0);
  });

  it("waits for a press on every line when auto-advance is off", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait, autoAdvance: false });
    expect(c.pending).toHaveLength(0);
    s.vn.advance();
    expect(c.pending).toHaveLength(0);
    s.vn.setAuto(true);
    expect(c.pending).toHaveLength(1);
    s.vn.setAuto(true); // the settings panel says it again
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(1); // one timer, not two
  });

  it("turning auto-advance off takes the clock off the line, and says so", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    let told = 0;
    s.vn.subscribe(() => told++);
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(1);
    s.vn.setAuto(false);
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(0);
    expect(told).toBe(1); // the settings row re-renders
  });

  it("the name box stops the clock on the line it is covering", () => {
    const c = clock();
    const s = setup(undefined, (course) => (course.needsName = true), { wait: c.wait });
    expect(s.vn.view().phase.kind).toBe("name");
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(0);
  });

  it("a name gives the line behind it its full reading time", () => {
    const c = clock();
    const s = setup(undefined, (course) => (course.needsName = true), { wait: c.wait });
    c.pending.forEach((w) => w.fire()); // however long the player took at the box
    expect(s.vn.setName("Mei")).toBe(true);
    const p = s.vn.view().phase;
    expect(p).toMatchObject({ kind: "beat", beat: { text: "You arrive with ¥20 and no words." } });
    if (p.kind !== "beat") return;
    const live = c.pending.filter((w) => !w.cancelled);
    expect(live).toHaveLength(1);
    expect(live[0].ms).toBe(dwellMs(p.beat)); // the whole reading time, from now
  });

  it("a second submit of the same name does nothing", () => {
    const c = clock();
    const s = setup(undefined, (course) => (course.needsName = true), { wait: c.wait });
    expect(s.vn.setName("Mei")).toBe(true);
    const logged = s.core.state.log.length;
    const armed = c.pending.length;
    expect(s.vn.setName("Mei")).toBe(true);
    expect(s.core.state.log.length).toBe(logged);
    expect(c.pending).toHaveLength(armed); // the line keeps the clock it already had
  });

  it("a controller the page has walked away from stops for good", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    s.vn.stop();
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(0);
    s.vn.hold(true); // an overlay opens and closes on a controller nobody is looking at
    s.vn.hold(false);
    s.vn.setAuto(true);
    expect(c.pending.filter((w) => !w.cancelled)).toHaveLength(0);
  });

  it("a press takes the line straight away, and the timer it cancelled does nothing after", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    const first = c.pending[0];
    s.vn.advance();
    expect(c.pending).toHaveLength(2);
    first.fire(); // the timer the press cancelled, dead like clearTimeout
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });
});
