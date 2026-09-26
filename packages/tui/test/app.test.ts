import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, PLAYER_MARK, type Course, type GameState } from "@silver-tongue/core";
import { addErrand, line } from "@silver-tongue/core/testing";
import { startApp } from "../src/app";
import type { AudioOut, Speech } from "../src/audio";
import { lineWidth } from "../src/width";
import { FakeTerminal, fixtureWithText, spacedWithText } from "./fake-terminal";

const T0 = 1_000_000;

function setup(patch: (s: GameState) => void = () => {}, change: (c: Course) => void = () => {}, make: () => Course = fixtureWithText) {
  const course = make();
  change(course);
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

  it("opens a new game with the story, wrapped to the screen", () => {
    const { term } = setup();
    const s = term.screen().join("\n");
    expect(s).toContain("You arrive with ¥20 and no words.");
    term.resize(40, 20);
    expect(term.screen().join("\n")).toMatch(/An old man on a bench is watching\s*│\n│ you with open curiosity\./);
  });

  it("skips the story when the game is already under way", () => {
    const { term } = setup((s) => {
      s.scenesDone.intro = 1;
    });
    expect(term.screen().join("\n")).not.toContain("no words");
    const moved = setup((s) => {
      s.place = "noodle_shop";
    });
    expect(moved.term.screen().join("\n")).not.toContain("no words");
  });

  it("narrates the start and end of a scene when the narration has lines for it", () => {
    const { term, core } = setup();
    term.press("1", "1");
    expect(term.screen().join("\n")).toContain("The cook looks up from a steaming pot");
    term.press(rightKey(core));
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("She hands you an apron.");
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
    expect(term.screen().join("\n")).toContain("好 hǎo — good");
    expect(core.state.words.w_hao.helps).toBe(1);
    term.press("escape");
    expect(term.screen().join("\n")).toContain("[1-3] reply");
  });

  it("heads the replies, counts them in the footer, and echoes the one chosen", () => {
    const { term, core } = setup();
    term.press("1", "1");
    let s = term.screen().join("\n");
    expect(s).toContain("Your reply:");
    expect(s).toMatch(/[1-3]\) 你好！/);
    expect(s).toContain("[1-3] reply");
    term.press(rightKey(core));
    s = term.screen().join("\n");
    expect(s).toContain("You: 你好！");
    expect(s).toContain(`[1-${core.state.run!.options.length}] reply`);
    expect(term.screen().filter((l) => l.includes("Your reply:")).length).toBe(1);
  });

  it("counts the menu items in the footer", () => {
    const { term } = setup();
    expect(term.screen().join("\n")).toContain("[1-3] choose");
  });

  it("word help can explain the whole sentence, without counting it as help on each word", () => {
    const { term, core } = setup();
    term.press("1", "1", "w");
    expect(term.screen().join("\n")).toContain("s) The whole sentence");
    expect(term.screen().join("\n")).toContain("[s] whole sentence");
    term.press("s");
    expect(term.screen().join("\n")).toContain("你好！ nǐ hǎo — Hello!");
    expect(core.state.words.w_hao.helps).toBe(0);
  });

  it("word help also looks up words that only appear in the replies", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core), "w");
    const s = term.screen().join("\n");
    const said = core.state.run!.combo.item === "tea" ? "茶" : "水";
    const other = said === "茶" ? "水" : "茶";
    expect(s).toContain(`1) ${said}`);
    expect(s).toContain("In the replies:");
    expect(s).toContain(`2) ${other}`);
    term.press("2");
    expect(term.screen().join("\n")).toContain(`${other} — ${other === "茶" ? "tea" : "water"}`);
  });

  it("offers no whole-sentence help for a line without a meaning", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core), "w");
    expect(term.screen().join("\n")).not.toContain("whole sentence");
  });

  it("q quits from the menu", () => {
    const { term, quitted } = setup();
    term.press("q");
    expect(quitted()).toBe(true);
  });

  it("builds a reply from tiles: add, undo, a wrong answer clears the input, then the right one", () => {
    const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };
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
    // A right answer is shown as the reply itself, punctuation and all.
    expect(term.screen().join("\n")).toContain(`You: ${want}？`);
    expect(term.screen().join("\n")).toContain("Done.");
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

  it("offers the player's name as a tile and says it in the answer", () => {
    const lapsed = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: T0, lastSeen: T0 };
    const { term, core } = setup(
      (s) => Object.assign(s, { place: "noodle_shop", player: "Jamil", words: { w_ni: { ...lapsed }, w_hao: { ...lapsed } } }),
      (c) => {
        c.needsName = true;
        c.scenes[0].exchanges[0].variants[""].reply = line(["你", "w_ni"], ["好", "w_hao"], ["，", null], [PLAYER_MARK, null], ["！", null]);
      },
    );
    term.press("1");
    expect(core.state.run!.mode).toBe("tiles");
    expect(term.screen().join("\n")).toContain("Jamil");
    const tiles = core.state.run!.tiles;
    term.press(...["你", "好", PLAYER_MARK].map((p) => String(tiles.indexOf(p) + 1)), "return");
    expect(term.screen().join("\n")).toContain("You: 你好，Jamil！");
  });

  it("won't sleep away from home, and says so", () => {
    const { term, core, saves } = setup(
      (s) => (s.place = "noodle_shop"),
      (c) => (c.world.home = "street"),
    );
    const savedBefore = saves.length;
    term.press("3");
    expect(term.screen().join("\n")).toContain("You want your own bed. Head home first.");
    expect(core.state.day).toBe(1);
    expect(saves.length).toBe(savedBefore); // a refused input isn't saved
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
    expect(term.screen().join("\n")).not.toContain("steaming pot");
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("Done.");
  });

  it("keeps working on a very short screen", () => {
    const { term } = setup();
    term.resize(30, 8);
    term.press("1");
    expect(term.frames.at(-1)!.length).toBe(8);
    for (const line of term.frames.at(-1)!) expect(lineWidth(line)).toBe(30);
    term.resize(30, 5); // the prompt alone fills the body
    expect(term.frames.at(-1)!.length).toBe(5);
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

  it("narrates what a reply did, and on a mix-up what was asked", () => {
    const { term, core } = setup((s) => {
      s.scenesDone.intro = 1;
      s.trust.cook = 2;
      s.place = "noodle_shop";
    });
    term.press("1");
    const { combo, options } = core.state.run!;
    const wrong = options.findIndex((k) => k !== comboKey(combo));
    term.press(String(wrong + 1));
    const s = term.screen().join("\n");
    expect(s).toMatch(/You set down (three|four) cups of (tea|water)\./);
    expect(s).toContain(`They wanted ${combo.count} cups of ${combo.item}.`);
    expect(s).not.toContain("That's not what they asked for.");
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain(`You set down ${combo.count} cups of ${combo.item}.`);
  });

  it("falls back to the generic mix-up line when there is no asked-for narration", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    const { combo, options } = core.state.run!;
    term.press(String(options.findIndex((k) => k !== comboKey(combo)) + 1));
    const s = term.screen().join("\n");
    expect(s).toMatch(/You repeat the word for (tea|water)\./);
    expect(s).toContain("That's not what they asked for.");
  });

  it("marks menu items that take a slot, and late rent in the HUD", () => {
    const { term } = setup((s) => {
      s.place = "noodle_shop";
      s.rentLate = true;
    });
    const s = term.screen().join("\n");
    expect(s).toContain("1) Talk to Cook: Say hello · 1 slot");
    expect(s).toContain("2) Go to The street"); // moving is free
    expect(s).not.toContain("The street · 1 slot");
    expect(s).toContain("· Pidgin · rent due");
  });

  it("hints when the mentor has a note, and a visit explains it", () => {
    const mentor = (c: Course) => {
      c.world.mentor = { npc: "cook", after: "intro" };
      c.notes = [{ id: "hao", trigger: { word: "w_hao" } }];
    };
    const { term, core } = setup(() => {}, mentor);
    term.press("1", "1");
    expect(term.screen().join("\n")).toContain("Cook seems to have something to tell you.");
    term.press(rightKey(core));
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("2) Ask Cook about the language · 1 slot");
    term.press("2");
    let s = term.screen().join("\n");
    expect(s).toContain("好 means good");
    expect(s).toContain("On its own, 好 agrees.");
    expect(s).not.toContain("Ask Cook about the language"); // nothing left to explain
  });

  it("on a wrong tiles answer, says what was asked but not an action", () => {
    const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };
    const { term, core } = setup((s) => {
      s.scenesDone.intro = 1;
      s.trust.cook = 2;
      s.place = "noodle_shop";
      for (const w of ["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"]) s.words[w] = { ...shaky };
    });
    term.press("1");
    expect(core.state.run!.mode).toBe("tiles");
    const { combo } = core.state.run!;
    term.press("1", "return");
    const s = term.screen().join("\n");
    expect(s).toContain(`They wanted ${combo.count} cups of ${combo.item}.`);
    expect(s).not.toContain("You set down");
    expect(s).toContain("tap the words in order, then press [enter]");
  });

  it("keeps the NPC's request on screen when the prompt nearly fills it", () => {
    const { term, core } = setup((s) => {
      s.scenesDone.intro = 1;
      s.trust.cook = 2;
      s.place = "noodle_shop";
    });
    term.press("1");
    const rows = core.state.run!.options.length + 1 + 1 + 2; // options, "Your reply:", one log line, frame
    term.resize(64, rows);
    expect(term.screen().join("\n")).toMatch(/Cook: .+。/);
  });

  it("opens the notebook with n, scrolls it, and goes back where it was", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    term.press("n");
    let s = term.screen();
    expect(s.join("\n")).toContain("Stage 1: 0 of 12 words known");
    expect(s.at(-1)).toContain("[↑↓] scroll");
    term.resize(64, 5);
    const top = term.screen()[1];
    term.press("down");
    expect(term.screen()[1]).not.toBe(top);
    term.press("up");
    expect(term.screen()[1]).toBe(top);
    term.resize(64, 20);
    term.press("escape");
    s = term.screen();
    expect(s.join("\n")).toContain("Your reply:");
    term.press("n", "n");
    expect(term.screen().join("\n")).toContain("Your reply:");
  });

  it("asks for the player's name first when the course's lines use it", () => {
    const { term, core } = setup(() => {}, (c) => {
      c.needsName = true;
    });
    let s = term.screen().join("\n");
    expect(s).toContain("what's your name?");
    expect(s).toContain("[enter] done");
    term.press("1"); // typing, not choosing from the menu
    term.press("backspace");
    term.type("Jamil");
    expect(term.screen().join("\n")).toContain("> Jamil");
    expect(term.cursor).toEqual({ row: term.rows - 2, col: 4 + 5 }); // after "│ > Jamil"
    term.press("return");
    expect(core.state.player).toBe("Jamil");
    s = term.screen().join("\n");
    expect(s).toContain("1) Go to Noodle shop");
    expect(term.cursor).toBeUndefined();
  });

  it("shows the game's version in the bottom border when given one", () => {
    const course = fixtureWithText();
    const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
    const term = new FakeTerminal();
    startApp({ course, core, term, now: () => T0, quit: () => {}, version: "0.5.0" });
    expect(term.screen().at(-1)).toMatch(/no audio · v0\.5\.0 ┘$/);
    term.resize(90, 20);
    expect(term.screen().at(-1)).toMatch(/no audio · Silver Tongue v0\.5\.0 ┘$/);
    term.resize(46, 20);
    expect(term.screen().at(-1)).toMatch(/^└ \[1-3\] choose · \[n\] notebook ─* no audio ┘$/);
  });

  const ERRAND_TEXT = `
scene-pickup = Take a parcel
scene-drop = Deliver the parcel
place-school = School
place-school-desc = A school.
npc-teacher = Teacher
asked-deliver = They wanted it taken to the { $place }.
`;
  /** Presses the number of the menu item whose label contains `label`. */
  const pressItem = (term: FakeTerminal, label: string) => {
    const row = term.screen().find((l) => l.includes(label));
    const n = row?.match(/(\d)\) /)?.[1];
    if (!n) throw new Error(`no menu item "${label}" in:\n${term.screen().join("\n")}`);
    term.press(n);
  };
  const answerAll = (core: ReturnType<typeof setup>["core"], term: FakeTerminal) => {
    for (let i = 0; core.state.run && i < 10; i++) {
      if (core.state.run.mode !== "pick") throw new Error("expected pick mode for fresh words");
      term.press(rightKey(core));
    }
  };

  it("says when you take a parcel and when you hand it over, and the status line and menu never say where it goes", () => {
    const { core, term } = setup(
      (s) => { s.place = "noodle_shop"; s.scenesDone = { intro: 1 }; },
      (c) => { addErrand(c); c.learnerFtl += ERRAND_TEXT; },
    );
    pressItem(term, "Take a parcel");
    answerAll(core, term);
    const taken = term.screen().join("\n");
    expect(taken).toContain("You're carrying a parcel.");
    expect(taken).not.toContain("New: Deliver the parcel");
    // The reply's own narration may name the place; the status line and the menu must not.
    const screen = term.screen();
    const menu = screen.slice(screen.findIndex((l) => l.includes("What now?")));
    expect([screen[0], ...menu].join("\n")).not.toMatch(/School|school/);
    pressItem(term, "Go to The street");
    pressItem(term, "Go to School");
    pressItem(term, "Deliver the parcel");
    answerAll(core, term);
    expect(term.screen().join("\n")).toContain("You hand over the parcel.");
  });

  it("marks the status line while a parcel is carried", () => {
    expect(setup((s) => { s.errand = { to: "street" }; }).term.screen().join("\n")).toMatch(/Day 1 .*· parcel/);
    expect(setup().term.screen().join("\n")).not.toContain("parcel");
  });

  it("keeps the status line inside a phone-width frame with a parcel and rent due", () => {
    const { term } = setup((s) => { s.errand = { to: "street" }; s.rentLate = true; });
    term.resize(40, 16);
    for (const l of term.frames.at(-1)!) expect(lineWidth(l)).toBe(40);
  });

  it("reminds you of the parcel above the menu, where a phone-width screen still shows it", () => {
    const { term } = setup((s) => { s.errand = { to: "street" }; });
    term.resize(40, 16);
    const menu = term.screen().slice(1).join("\n");
    expect(menu).toContain("You have a parcel to deliver.");
    expect(setup().term.screen().slice(1).join("\n")).not.toContain("parcel to deliver");
  });

  it("shows money spent in a shop as shopping", () => {
    const { core, term } = setup(
      (s) => { s.place = "noodle_shop"; },
      (c) => { c.scenes[0].exchanges[0].variants[""].cost = 2; },
    );
    pressItem(term, "Say hello");
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("-¥2 (shopping)");
  });

  it("says when a scene here waits only for money, without offering it", () => {
    const { term } = setup(
      (s) => { s.place = "noodle_shop"; },
      (c) => { c.scenes[0].exchanges[0].variants[""].cost = 30; },
    );
    const screen = term.screen().join("\n");
    expect(screen).toContain("Cook: Say hello · needs ¥30");
    expect(screen).not.toMatch(/\d\) Talk to Cook: Say hello/);
  });

  describe("sound", () => {
    /** Each line, word and reaction gets one clip named after its text, so calls read as text. */
    function voice(c: Course) {
      const set = (l: { text: string; audio?: string[] } | undefined) => l && (l.audio = [l.text]);
      for (const s of c.scenes)
        for (const ex of s.exchanges)
          for (const v of Object.values(ex.variants)) [v.npc, v.reply, v.rephrase, ...(v.alts ?? [])].forEach(set);
      for (const w of Object.values(c.words)) w.audio = [w.w];
      c.reactionAudio = Object.fromEntries(Object.entries(c.reactions).map(([id, l]) => [id, { cook: [`cook:${l.text}`] }]));
    }

    function withAudio(available = true, patch: (s: GameState) => void = () => {}) {
      const calls: Speech[][] = [];
      let stops = 0;
      const audio: AudioOut = { available, play: (l) => void calls.push(l), stop: () => void stops++ };
      const course = fixtureWithText();
      voice(course);
      const state = newGame(course);
      patch(state);
      const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
      const term = new FakeTerminal();
      const saves: GameState[] = [];
      startApp({ course, core, term, now: () => T0, save: (s) => saves.push(s) > 0, quit: () => {}, audio, version: "0.12.0" });
      return { core, term, calls, saves, stops: () => stops };
    }
    const npcText = (core: ReturnType<typeof withAudio>["core"]) => {
      const run = core.state.run!;
      return fixtureWithText().scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].variants[comboKey(run.combo)].npc.text;
    };

    it("says the NPC's line when a scene starts", () => {
      const { term, calls } = withAudio();
      term.press("1", "1");
      expect(calls.at(-1)).toEqual([{ clips: ["你好！"] }]);
    });

    it("says your reply, then the NPC's next line, as one queue", () => {
      const { term, core, calls } = withAudio();
      term.press("1", "1");
      term.press(rightKey(core));
      expect(calls.at(-1)).toEqual([{ clips: ["你好！"] }, { clips: [npcText(core)] }]);
    });

    it("says the right reply when the tiles match, and no reply when they don't", () => {
      const shaky = { right: 1, wrong: 1, streak: 0, helps: 0, lapsed: true, firstSeen: 0, lastSeen: 0 };
      const { term, core, calls } = withAudio(true, (s) => {
        s.words.w_cha = { ...shaky };
        s.words.w_shui = { ...shaky };
      });
      term.press("1", "1");
      term.press(rightKey(core));
      const tiles = core.state.run!.tiles;
      const want = core.state.run!.combo.item === "tea" ? "茶" : "水";
      term.press(String(tiles.findIndex((x) => x !== want) + 1), "return");
      expect(calls.at(-1)![0]).toEqual({ clips: ["cook:不是这个。"] });
      term.press(String(tiles.indexOf(want) + 1), "return");
      expect(calls.at(-1)![0]).toEqual({ clips: [`${want}？`] });
    });

    it("says your wrong reply and the NPC's reaction, and a line repeated with no rephrase slowly", () => {
      const { term, core, calls } = withAudio();
      term.press("1", "1");
      term.press(rightKey(core));
      const asked = npcText(core);
      const wrongKey = () => String(core.state.run!.options.findIndex((k) => k !== comboKey(core.state.run!.combo)) + 1);
      term.press(wrongKey());
      expect(calls.at(-1)!.slice(0, 2)).toEqual([{ clips: [asked === "茶。" ? "水？" : "茶？"] }, { clips: ["cook:不是这个。"] }]);
      term.press(wrongKey());
      expect(calls.at(-1)).toContainEqual({ clips: [asked], slow: true });
    });

    it("r says the last line again; m turns sound off, and then nothing plays, and m turns it back on", () => {
      const { term, core, calls, stops, saves } = withAudio();
      term.press("1", "1");
      const n = calls.length;
      term.press("r");
      expect(calls.length).toBe(n + 1);
      expect(calls.at(-1)).toEqual([{ clips: ["你好！"] }]);
      term.press("m");
      expect(core.state.sound).toBe(false);
      expect(saves.at(-1)!.sound).toBe(false);
      expect(stops()).toBeGreaterThan(0);
      term.press("r");
      term.press(rightKey(core));
      expect(calls.length).toBe(n + 1);
      term.press("m");
      expect(core.state.sound).toBe(true);
      term.press("r");
      expect(calls.length).toBe(n + 2);
    });

    it("looking up a word says it, and p says it again", () => {
      const { term, calls } = withAudio();
      term.press("1", "1", "w", "1");
      expect(calls.at(-1)).toEqual([{ clips: ["你"] }]);
      const n = calls.length;
      term.press("p");
      expect(calls.length).toBe(n + 1);
      expect(calls.at(-1)).toEqual([{ clips: ["你"] }]);
    });

    it("shows ♪, ♪ off or no audio in the bottom border", () => {
      const on = withAudio();
      expect(on.term.screen().at(-1)).toMatch(/♪ \[m\] · v0\.12\.0 ┘$/);
      on.term.press("m");
      expect(on.term.screen().at(-1)).toContain("♪ off [m]");
      expect(withAudio(false).term.screen().at(-1)).toContain("no audio");
      const course = fixtureWithText();
      const term = new FakeTerminal();
      startApp({ course, core: createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) }), term, now: () => T0, quit: () => {} });
      expect(term.screen().at(-1)).toContain("no audio");
    });

    it("the whole sentence is said too, and p says it again", () => {
      const { term, calls } = withAudio();
      term.press("1", "1", "w", "s");
      expect(calls.at(-1)).toEqual([{ clips: ["你好！"] }]);
      const n = calls.length;
      term.press("p");
      expect(calls.length).toBe(n + 1);
      expect(calls.at(-1)).toEqual([{ clips: ["你好！"] }]);
    });

    it("r says nothing once the scene is over", () => {
      const { term, core, calls } = withAudio();
      term.press("1", "1");
      term.press(rightKey(core));
      term.press(rightKey(core));
      expect(core.state.run).toBeNull();
      const n = calls.length;
      term.press("r");
      expect(calls.length).toBe(n);
    });

    it("m does nothing where there is no audio", () => {
      const { term, core, saves } = withAudio(false);
      const n = saves.length;
      term.press("m");
      expect(core.state.sound).toBeUndefined();
      expect(saves.length).toBe(n);
    });

    it("lists r at phone width while picking, and n in tiles mode", () => {
      const { term, core } = withAudio();
      term.resize(46, 20);
      term.press("1", "1");
      expect(term.screen().at(-1)).toMatch(/^└ \[1-3\] reply · \[w\] help · \[r\] again ─* ♪ \[m\] ┘$/);
      expect(fixtureWithText().learnerFtl).toMatch(/keys-tiles = .*\[n\] notebook/);
      void core;
    });

    it("plays nothing while sound is off or unavailable", () => {
      const off = withAudio(true, (s) => (s.sound = false));
      off.term.press("1", "1");
      expect(off.calls).toEqual([]);
      const none = withAudio(false);
      none.term.press("1", "1");
      expect(none.calls).toEqual([]);
    });
  });
});

describe("languages", () => {
  const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
  const allKnown = (s: GameState) => {
    for (const id of Object.keys(spacedWithText().words)) s.words[id] = { ...known };
    s.place = "noodle_shop";
  };

  it("shows tiles and the echo with spaces in a spaced language", () => {
    const { term, core } = setup(allKnown, () => {}, spacedWithText);
    term.resize(46, 20);
    term.press("1"); // talk to the cook
    expect(core.state.run!.mode).toBe("tiles");
    const run = core.state.run!;
    for (const p of ["mi", "bon"]) term.press(String(run.tiles.indexOf(p) + 1));
    expect(term.screen().find((l) => l.includes("You say:"))).toContain("You say: mi bon");
    term.press("return");
    expect(term.screen().join("\n")).toContain("You: mi bon!");
  });

  it("echoes wrong tiles with spaces between them", () => {
    const { term, core } = setup(allKnown, () => {}, spacedWithText);
    term.resize(46, 20);
    term.press("1");
    const run = core.state.run!;
    for (const p of ["bon", "mi"]) term.press(String(run.tiles.indexOf(p) + 1));
    term.press("return");
    expect(term.screen().join("\n")).toContain("You: bon mi");
  });

  it("shows every reading in word help, and the last one for the sentence", () => {
    const { term } = setup((s) => (s.place = "noodle_shop"), () => {}, spacedWithText);
    term.resize(46, 20);
    term.press("1"); // talk to the cook
    term.press("w", "1");
    expect(term.screen().join("\n")).toContain("mi mí mi — you");
    term.press("s");
    expect(term.screen().join("\n")).toContain("mi bon! mi bon — Hello!");
  });
});
