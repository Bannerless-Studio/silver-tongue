import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, PLAYER_MARK, type CatalogEntry, type Course, type GameState } from "@silver-tongue/core";
import { addErrand, line } from "@silver-tongue/core/testing";
import { startApp, type AppOptions } from "../src/app";
import type { AudioOut, Speech, SpeechSpeed } from "@silver-tongue/view";
import { lineWidth } from "../src/width";
import { FakeTerminal, fixtureWithText, spacedWithText } from "./fake-terminal";

const T0 = 1_000_000;

function setup(
  patch: (s: GameState) => void = () => {},
  change: (c: Course) => void = () => {},
  make: () => Course = fixtureWithText,
  settings?: AppOptions["settings"],
  audio?: AudioOut,
  speed?: AppOptions["speed"],
) {
  const course = make();
  change(course);
  const state = newGame(course);
  patch(state);
  const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
  const term = new FakeTerminal();
  const saves: GameState[] = [];
  let quit = false;
  startApp({ course, core, term, now: () => T0, save: (s) => saves.push(s) > 0, quit: () => (quit = true), settings, audio, speed });
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

  it("puts the day in the top border and money, rent and rank in the HUD row", () => {
    const { term } = setup();
    const s = term.screen();
    expect(s[0]).toMatch(/^┌ The street ─+ Day 1 · slot 0\/4 ┐$/);
    expect(s[1]).toContain("¥20 · rent in 6 days · Speaks: Pidgin");
  });

  it("shows a line's reading under it while its words are new, and not once they're known", () => {
    const { term } = setup();
    term.press("1", "1");
    expect(term.screen().join("\n")).toMatch(/Cook: 你好！ *│\n│ +nǐ hǎo/);
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };
    const again = setup((s) => (s.words = { w_ni: { ...known }, w_hao: { ...known } }));
    again.term.press("1", "1");
    expect(again.term.screen().join("\n")).not.toContain("nǐ hǎo");
  });

  it("opens a looked-up word in a card above the replies, closed by a reply or esc", () => {
    const { term, core } = setup();
    term.press("1", "1", "w", "1");
    const s = term.screen();
    const card = s.findIndex((l) => l.includes("你 nǐ — you"));
    expect(card).toBeGreaterThan(0);
    expect(card).toBeLessThan(s.findIndex((l) => l.includes("Which word?"))); // still in help: its panel is below
    term.press("escape"); // back from the word list; the card stays
    expect(term.screen().join("\n")).toContain("你 nǐ — you");
    term.press("escape"); // closes the card
    expect(term.screen().join("\n")).not.toContain("你 nǐ — you");
    term.press("w", "1", "escape", rightKey(core)); // a reply closes it too
    expect(term.screen().join("\n")).not.toContain("你 nǐ — you");
  });

  it("gives up the word card, then the HUD, before the log's last row on a short screen", () => {
    const { term } = setup();
    term.press("1", "1", "w", "1", "escape");
    term.resize(40, 8);
    const f = term.frames.at(-1)!;
    expect(f.length).toBe(8);
    for (const l of f) expect(lineWidth(l)).toBe(40);
    const s = term.screen().join("\n");
    expect(s).not.toContain("你 nǐ — you");
    expect(s).toMatch(/1\) /);
  });

  it("draws every screen inside the terminal at phone, short, laptop and wide sizes", () => {
    for (const [cols, rows] of [[40, 12], [40, 8], [80, 24], [120, 40]]) {
      const { term } = setup();
      term.resize(cols, rows);
      const check = () => {
        const f = term.frames.at(-1)!;
        expect(f.length).toBe(rows);
        for (const l of f) expect(lineWidth(l)).toBe(cols);
        expect(term.screen().at(-1)).toContain("[");
      };
      check(); // explore
      term.press("1", "1");
      check(); // a scene: pick a reply
      term.press("w");
      check(); // help: the word list
      term.press("1");
      check(); // a word card
      term.press("escape");
      check();
      term.press("n");
      check(); // the notebook
      term.press("escape");
    }
  });

  it("credits Bannerless Studio next to the version when there is room", () => {
    const course = fixtureWithText();
    const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
    const term = new FakeTerminal(120, 20);
    startApp({ course, core, term, now: () => T0, quit: () => {}, version: "0.16.1" });
    expect(term.screen().at(-1)).toMatch(/no audio · Silver Tongue v0\.16\.1 · by Bannerless Studio ┘$/);
  });

  it("opens a new game with the story, wrapped to the screen", () => {
    const { term } = setup();
    const s = term.screen().join("\n");
    expect(s).toContain("You arrive with ¥20 and no words.");
    term.resize(40, 20);
    expect(term.screen().join("\n")).toMatch(/An old man on a bench is watching you\s*\nwith open curiosity\./);
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

  it("narrates a repeatable scene the first time, but not on a repeat", () => {
    const { term, core } = setup();
    term.press("1", "1"); // greet the cook: starts intro
    term.press(rightKey(core));
    term.press(rightKey(core)); // ends intro; trust is now enough for the repeatable "shift"
    term.press("1"); // talk to the cook again: starts shift, first time
    expect(core.state.run?.scene).toBe("shift");
    expect(term.screen().join("\n")).toContain("The cook slides a tray across the counter.");
    term.press(rightKey(core)); // ends shift, first time
    expect(term.screen().join("\n")).toContain("The cook nods and turns back to the pot.");
    term.press("1"); // start shift again: a repeat
    expect(core.state.run?.scene).toBe("shift");
    expect(term.screen().join("\n")).not.toContain("The cook slides a tray across the counter.");
    term.press(rightKey(core)); // ends shift again: also a repeat
    expect(term.screen().join("\n")).not.toContain("The cook nods and turns back to the pot.");
  });

  it("a paid scene's wallet line says it earned; no separate 'Done.' line", () => {
    const { term, core } = setup();
    term.press("1", "1"); // greet the cook: starts and ends intro
    term.press(rightKey(core));
    term.press(rightKey(core));
    term.press("1"); // start shift, which pays on the right answer
    term.press(rightKey(core)); // ends shift, paid
    const s = term.screen().join("\n");
    expect(s).toMatch(/\+¥\d+ \(wages\)/);
    expect(s).not.toContain("Done.");
  });

  it("shows the trust line only when it unlocks a scene, and drops the number", () => {
    const { term, core } = setup();
    term.press("1", "1"); // intro ends: trust reaches the threshold that unlocks "shift"
    term.press(rightKey(core));
    term.press(rightKey(core));
    let s = term.screen().join("\n");
    expect(s).toContain("Cook trusts you a little more.");
    expect(s).not.toMatch(/trusts you a little more \(\d+\)/); // no raw number
    expect(s).toContain("New: Serve drinks");
    term.press("1"); // shift, already unlocked: ending it again gains trust but unlocks nothing new
    term.press(rightKey(core));
    s = term.screen().join("\n");
    expect(s).not.toContain("trusts you a little more");
  });

  it("joins three or more simultaneous unlocks onto one 'New:' line", () => {
    const { term, core } = setup(undefined, (c) => {
      const extra = structuredClone(c.scenes[1]); // "shift": requires trust.cook >= 1, like the new ones
      c.scenes.push({ ...extra, id: "extra1" }, { ...extra, id: "extra2" });
    });
    term.press("1", "1"); // intro ends, unlocking shift, extra1 and extra2 at once
    term.press(rightKey(core));
    term.press(rightKey(core));
    const s = term.screen().join("\n");
    expect(s).toContain("New: Serve drinks, scene-extra1, scene-extra2");
    expect(s).not.toContain("New: Serve drinks\n"); // not one line per scene
  });

  it("keeps a cross-place batch readable: ', ' between scenes, ' · place' only on the elsewhere ones", () => {
    const { term, core } = setup(undefined, (c) => {
      const extra = structuredClone(c.scenes[1]); // "shift": requires trust.cook >= 1, like the new ones
      c.scenes.push({ ...extra, id: "extra1", place: "street" }, { ...extra, id: "extra2" });
    });
    term.press("1", "1"); // intro ends, unlocking shift (here), extra1 (street) and extra2 (here) at once
    term.press(rightKey(core));
    term.press(rightKey(core));
    const s = term.screen().join("\n");
    expect(s).toContain("New: Serve drinks, scene-extra1 · The street, scene-extra2");
  });

  it("shows each reply's meaning, dimmed, so a beginner can pick one", () => {
    const { term, core } = setup();
    term.press("1", "1");
    const replyLines = term.screen().filter((l) => /^\│ \d\) /.test(l));
    expect(replyLines.length).toBe(3);
    const right = String(core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) + 1);
    expect(replyLines.find((l) => l.startsWith(`│ ${right}) `))).toContain("你好！  — Hello!");
    // The written wrong replies have no learner-language meaning of their own: no dash for them.
    for (const l of replyLines.filter((l) => !l.startsWith(`│ ${right}) `))) expect(l).not.toContain("—");
  });

  it("clears the log's intro and place text once a scene starts, and doesn't bring them back", () => {
    const { term, core } = setup();
    term.press("1"); // go to the noodle shop
    expect(term.screen().join("\n")).toContain("Steam everywhere.");
    term.press("1"); // talk to the cook: starts the scene
    const started = term.screen().join("\n");
    expect(started).not.toContain("Steam everywhere.");
    expect(started).not.toContain("You arrive with");
    expect(started).toContain("The cook looks up from a steaming pot");
    term.press(rightKey(core));
    term.press(rightKey(core)); // the scene ends
    const ended = term.screen().join("\n");
    expect(ended).toContain("She hands you an apron.");
    expect(ended).not.toContain("You arrive with");
    expect(ended).toContain("· Cook");
  });

  it("glosses first-time words under the NPC's line, once per word", () => {
    const { term, core } = setup();
    term.press("1", "1");
    expect(term.screen().join("\n")).toContain("你 nǐ you · 好 hǎo good");
    term.press(rightKey(core));
    term.press(rightKey(core)); // finishes "intro"; "shift" (repeatable) is now available
    pressItem(term, "Serve drinks · Cook");
    expect(term.screen().join("\n")).toContain("杯 cup");
    term.press(rightKey(core)); // finishes this run of "shift"
    pressItem(term, "Serve drinks · Cook"); // met words don't get glossed again
    expect(term.screen().join("\n")).not.toContain("杯 cup");
  });

  it("has the NPC gesture and give the meaning after two wrong replies", () => {
    const { term, core } = setup();
    term.press("1", "1");
    const wrongOnce = () => {
      const { combo, options } = core.state.run!;
      term.press(String(options.findIndex((k) => k !== comboKey(combo)) + 1));
    };
    wrongOnce();
    wrongOnce();
    const s = term.screen().join("\n");
    expect(s).toContain("Cook mimes it:");
    expect(s).toContain("Hello!");
  });

  it("starts on the street with a menu and a HUD", () => {
    const { term } = setup();
    const s = term.screen().join("\n");
    expect(s).toContain("The street");
    expect(s).toContain("Day 1 · slot 0/4");
    expect(s).toContain("¥20 · rent in 6 days");
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
    expect(s).toContain("Cook trusts you a little more.");
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
    expect(s).toContain("Your reply");
    expect(s).toMatch(/[1-3]\) 你好！/);
    expect(s).toContain("[1-3] reply");
    term.press(rightKey(core));
    s = term.screen().join("\n");
    expect(s).toContain("You: 你好！");
    expect(s).toContain(`[1-${core.state.run!.options.length}] reply`);
    expect(term.screen().filter((l) => l.includes("Your reply")).length).toBe(1);
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
    expect(term.screen().join("\n")).toContain("That's not what was asked.");
    expect(term.screen().at(-2)).toMatch(/You say: +│$/);
    term.press(right, "return");
    // A right answer is shown as the reply itself, punctuation and all.
    expect(term.screen().join("\n")).toContain(`You: ${want}？`);
    // The intro scene is unpaid: no "Done." line, just the trust it unlocks a new scene with.
    expect(term.screen().join("\n")).not.toContain("Done.");
    expect(term.screen().join("\n")).toContain("New: Serve drinks");
  });

  it("a wrong pick shows the reaction, and word help still offers the request", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    const wrong = String(core.state.run!.options.findIndex((k) => k !== comboKey(core.state.run!.combo)) + 1);
    term.press(wrong);
    const s = term.screen().join("\n");
    expect(s).toContain("That's not what was asked.");
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

  it("sleeps rough away from home before the home scene is done, and says so", () => {
    const { term } = setup(
      (s) => (s.place = "noodle_shop"),
      (c) => {
        c.world.home = "street";
        c.world.homeScene = "intro";
      },
    );
    term.press("3"); // sleep: not home, but the home scene isn't done, so it still works
    const s = term.screen().join("\n");
    expect(s).toContain("Day 1 is over. You sleep rough by the road.");
    expect(s).toContain("Day 2 · slot 0/4");
  });

  it("goes back to home-only sleep, without rough wording, once the home scene is done", () => {
    const { term } = setup(
      (s) => {
        s.place = "noodle_shop";
        s.scenesDone.intro = 1;
      },
      (c) => {
        c.world.home = "street";
        c.world.homeScene = "intro";
      },
    );
    term.press("2"); // sleep, away from home: rejected, same as a course without homeScene
    expect(term.screen().join("\n")).toContain("You want your own bed. Head home first.");
  });

  it("doesn't hint 'go home first' on the sleep item before the home scene is done", () => {
    const { term } = setup(
      (s) => (s.place = "noodle_shop"),
      (c) => {
        c.world.home = "street";
        c.world.homeScene = "intro";
      },
    );
    const frame = term.frames.at(-1)!;
    const line = frame.find((l) => l.some((span) => span.text.includes("Sleep")))!;
    expect(line.map((span) => span.text).join("")).toContain("Sleep (end the day)");
    expect(line.map((span) => span.text).join("")).not.toContain("go home first");
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
    // The intro scene is unpaid: no "Done." line, just the trust it unlocks a new scene with.
    expect(term.screen().join("\n")).not.toContain("Done.");
    expect(term.screen().join("\n")).toContain("New: Serve drinks");
  });

  it("keeps the place description when resuming mid-scene at startup", () => {
    const first = setup();
    first.term.press("1", "1");
    const course = fixtureWithText();
    const core = createCore(course, first.core.state, { now: () => T0, rng: mulberry32(2) });
    const term = new FakeTerminal();
    startApp({ course, core, term, now: () => T0, save: () => true, quit: () => {} });
    expect(term.screen().join("\n")).toContain("Steam everywhere."); // place desc survives the resume
  });

  it("re-shows a pending mentor hint on resume, even though quitting lost it from memory", () => {
    // The note went ready in a previous session and was never shown (quit mid-scene): only
    // core.state.notes.ready remembers it across the restart.
    const { term } = setup(
      (s) => (s.notes.ready = ["hao"]),
      (c) => (c.world.mentor = { npc: "cook", after: "intro" }),
    );
    expect(term.screen().join("\n")).toContain("Cook seems to have something to tell you.");
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
    term.press("1"); // the failed save's warning shows right away, before the scene it leads into clears the log
    expect(term.screen().filter((l) => l.includes("can't be saved"))).toHaveLength(1);
    term.press("1");
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
    expect(s).not.toContain("That's not what was asked.");
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
    expect(s).toContain("That's not what was asked.");
  });

  it("shows a scene's slot cost only in the HUD, not the menu, and shows late rent in the HUD", () => {
    const { term } = setup((s) => {
      s.place = "noodle_shop";
      s.rentLate = true;
    });
    const s = term.screen().join("\n");
    expect(s).toContain("1) Say hello · Cook");
    expect(s).toContain("2) Go to The street"); // moving is free
    expect(s).not.toContain("The street · 1 slot");
    expect(s).not.toContain("Say hello · Cook · 1 slot");
    expect(s).toContain("¥20 · rent late");
  });

  it("hints when the mentor has a note, and a visit explains it", () => {
    const mentor = (c: Course) => {
      c.world.mentor = { npc: "cook", after: "intro" };
      c.notes = [{ id: "hao", trigger: { word: "w_hao" } }];
    };
    const { term, core } = setup(() => {}, mentor);
    term.press("1", "1");
    // The note's word was just heard, but mid-scene isn't when to say so.
    expect(term.screen().join("\n")).not.toContain("Cook seems to have something to tell you.");
    term.press(rightKey(core));
    term.press(rightKey(core));
    // Back in explore mode, the buffered hint appears once.
    expect(term.screen().join("\n")).toContain("Cook seems to have something to tell you.");
    expect(term.screen().join("\n")).toContain("2) Ask Cook about the language");
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
    // The reply prompt's key range matches however many tiles there are to pick from.
    expect(s).toContain(`Build your reply: [1-${core.state.run!.tiles.length}] add a word · [enter] say it`);
  });

  it("keeps the NPC's request on screen when the prompt nearly fills it", () => {
    const { term, core } = setup((s) => {
      s.scenesDone.intro = 1;
      s.trust.cook = 2;
      s.place = "noodle_shop";
    });
    term.press("1");
    // frame 2 + HUD 1 + log rule 1 + the NPC's line, its reading and its first-time gloss 3
    // + reply rule 1 + options
    const rows = 2 + 1 + 1 + 3 + 1 + core.state.run!.options.length;
    term.resize(64, rows);
    expect(term.screen().join("\n")).toMatch(/Cook: .+。/);
  });

  it("opens the notebook with n: words by group, notes, and back where it was", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    term.press("n");
    let s = term.screen();
    expect(s[0]).toMatch(/Notebook ─+ Speaks: Pidgin/);
    expect(s.join("\n")).toContain("Stage 1: 0 of 12 words known");
    expect(s.join("\n")).toMatch(/▸ Recent \(\d+\)/);
    expect(s.at(-1)).toContain("[esc] back");
    // the chosen word: the right-hand column's row that starts with ▸
    const chosen = () => term.screen().map((l) => l.split(" │ ")[1] ?? "").find((r) => r.startsWith("▸ "));
    const first = chosen();
    expect(first).toBeDefined();
    term.press("down");
    expect(chosen()).not.toBe(first);
    term.press("2");
    expect(term.screen().join("\n")).toContain("No notes yet.");
    term.press("escape");
    s = term.screen();
    expect(s.join("\n")).toContain("Your reply");
    term.press("n", "n");
    expect(term.screen().join("\n")).toContain("Your reply");
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
    expect(term.screen().at(-1)).toMatch(/^─ \[1-3\] choose · \[n\] notebook ─* no audio ─$/);
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

  it("says nothing extra for taking a parcel (the header's own marker already says it), but does say when you hand it over", () => {
    const { core, term } = setup(
      (s) => { s.place = "noodle_shop"; s.scenesDone = { intro: 1 }; },
      (c) => { addErrand(c); c.learnerFtl += ERRAND_TEXT; },
    );
    pressItem(term, "Take a parcel");
    answerAll(core, term);
    const taken = term.screen().join("\n");
    expect(taken).not.toContain("You're carrying a parcel."); // the header's "· parcel" already says so
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
    expect(setup((s) => { s.errand = { to: "street" }; }).term.screen().join("\n")).toMatch(/¥20 · .*· parcel/);
    expect(setup().term.screen().join("\n")).not.toContain("parcel");
  });

  it("keeps the status line inside a phone-width frame with a parcel and rent due", () => {
    const { term } = setup((s) => { s.errand = { to: "street" }; s.rentLate = true; });
    term.resize(40, 16);
    for (const l of term.frames.at(-1)!) expect(lineWidth(l)).toBe(40);
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
    expect(screen).not.toMatch(/\d\) Say hello · Cook/);
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

    it("shows nothing while sound plays, ♪ off [m] when muted, or no audio when there's none", () => {
      const on = withAudio();
      expect(on.term.screen().at(-1)).toMatch(/v0\.12\.0 ┘$/);
      expect(on.term.screen().at(-1)).not.toContain("♪");
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
      expect(term.screen().at(-1)).toMatch(/^─ \[1-3\] reply · \[w\] help · \[r\] again ─*─$/);
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

describe("settings screen", () => {
  const catalog: CatalogEntry[] = [
    { id: "test-course", language: "zh", setting: "s", learners: ["en", "fr"], learnerNames: { en: "English", fr: "Français" } },
    { id: "xx-town", language: "xx", setting: "s", learners: ["en"], learnerNames: { en: "English" } },
  ];
  const names = (c: Course) => (c.learnerFtl += "\nlanguage-zh = Chinese\nlanguage-xx = Testish\n");
  const withSettings = (audio?: AudioOut) => {
    const calls: [string, string][] = [];
    const s = setup(
      () => {},
      names,
      fixtureWithText,
      { courses: catalog, switchTo: (course, learner) => void calls.push([course, learner]) },
      audio,
      { value: "slow", onChange: () => {} }, // this suite plays a terminal front end, which offers a Speed row
    );
    s.term.resize(46, 20);
    return { ...s, calls };
  };
  const screen = (term: FakeTerminal) => term.screen().join("\n");

  it("lists what is learned, the reading language and sound, at 46 columns", () => {
    const { term } = withSettings();
    term.press("o");
    expect(screen(term)).toContain("Settings");
    expect(screen(term)).toContain("1) Learning: Chinese");
    expect(screen(term)).toContain("2) Reading: English");
    expect(screen(term)).toContain("3) Sound: no audio (or [m])");
    expect(screen(term)).toContain("4) Speed: slow");
    expect(screen(term)).toContain("[1-4] change");
    for (const l of term.frames.at(-1)!) expect(lineWidth(l)).toBe(46);
    term.press("escape");
    expect(screen(term)).not.toContain("Settings");
  });

  it("switches course, keeping the reading language when the other course has it", () => {
    const { term, calls, saves } = withSettings();
    const before = saves.length;
    term.press("o", "1");
    expect(screen(term)).toContain("1) Chinese (now)");
    expect(screen(term)).toContain("2) Testish");
    term.press("2");
    expect(calls).toEqual([["xx-town", "en"]]);
    expect(saves.length).toBe(before + 1); // saves before switching
  });

  it("draws nothing more once it has handed over to another course", () => {
    let framesAtSwitch = -1;
    const s = setup(() => {}, names, fixtureWithText, {
      courses: catalog,
      switchTo: () => void (framesAtSwitch = s.term.frames.length),
    });
    s.term.press("o", "1", "2");
    expect(s.term.frames.length).toBe(framesAtSwitch);
    s.term.press("1");
    expect(s.term.frames.length).toBe(framesAtSwitch);
  });

  it("switches reading language", () => {
    const { term, calls } = withSettings();
    term.press("o", "2");
    expect(screen(term)).toContain("2) Français");
    term.press("2");
    expect(calls).toEqual([["test-course", "fr"]]);
  });

  it("hands over the game being played, so a switch keeps progress that wasn't saved", () => {
    let handed: unknown;
    const s = setup(() => {}, names, fixtureWithText, { courses: catalog, switchTo: (_c, _l, state) => void (handed = state) });
    s.term.press("o", "2", "2");
    expect(handed).toBe(s.core.state);
  });

  it("does nothing when the current entry is chosen", () => {
    const { term, calls } = withSettings();
    term.press("o", "1", "1");
    expect(calls).toEqual([]);
    expect(screen(term)).toContain("1) Learning: Chinese");
  });

  it("opens from help and goes back there", () => {
    const { term } = withSettings();
    term.press("1", "1"); // to the noodle shop, then talk to the cook
    term.press("w", "o");
    expect(screen(term)).toContain("Settings");
    term.press("escape");
    expect(screen(term)).toContain("Which word?"); // back in help, not explore
  });

  it("toggles sound from the settings screen", () => {
    const audio: AudioOut = { available: true, play: () => {}, stop: () => {} };
    const { term, core } = withSettings(audio);
    term.press("o", "3");
    expect(core.state.sound).toBe(false);
    expect(screen(term)).toContain("3) Sound: off (or [m])");
  });

  it("cycles speed from the settings screen and remembers the choice", () => {
    const changes: SpeechSpeed[] = [];
    const course = fixtureWithText();
    course.learnerFtl += "\nlanguage-zh = Chinese\nlanguage-xx = Testish\n";
    const state = newGame(course);
    const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
    const term = new FakeTerminal();
    term.resize(46, 20);
    startApp({
      course, core, term, now: () => T0, quit: () => {},
      settings: { courses: catalog, switchTo: () => {} },
      speed: { value: "slow", onChange: (s) => changes.push(s) },
    });
    term.press("o", "4");
    expect(screen(term)).toContain("4) Speed: normal");
    term.press("4");
    expect(screen(term)).toContain("4) Speed: fast");
    term.press("4");
    expect(screen(term)).toContain("4) Speed: slow");
    expect(changes).toEqual(["normal", "fast", "slow"]);
  });

  it("shows no Speed row or sound key-hint without a speed option (the web text page)", () => {
    const calls: [string, string][] = [];
    const { term } = setup(() => {}, names, fixtureWithText, { courses: catalog, switchTo: (course, learner) => void calls.push([course, learner]) });
    term.resize(46, 20);
    term.press("o");
    expect(screen(term)).toContain("3) Sound: no audio");
    expect(screen(term)).not.toContain("(or [m])");
    expect(screen(term)).not.toContain("Speed");
    expect(screen(term)).toContain("[1-3] change");
  });

  it("has no [o] without settings", () => {
    const { term } = setup();
    term.resize(120, 20);
    term.press("o");
    expect(screen(term)).not.toContain("Settings");
    expect(screen(term)).not.toContain("[o]");
  });

  it("lists [o] in the footer when there is room", () => {
    const { term } = withSettings();
    term.resize(120, 20);
    expect(term.screen().at(-1)).toContain("[o] settings");
  });
});

describe("menu surprisal and place notices", () => {
  it("names the place too when an unlocked scene is somewhere else, but not when it's here", () => {
    const { term, core } = setup(undefined, (c) => {
      const shift = structuredClone(c.scenes[1]); // "shift": requires trust.cook >= 1, same as the new one
      c.scenes.push({ ...shift, id: "elsewhere", place: "street" });
    });
    term.press("1", "1"); // intro ends at the noodle shop: unlocks "shift" (here) and "elsewhere" (street)
    term.press(rightKey(core));
    term.press(rightKey(core));
    const s = term.screen().join("\n");
    expect(s).toContain("New: Serve drinks"); // same place as here: no place named
    expect(s).not.toContain("Serve drinks · Noodle shop");
    expect(s).toContain("New: scene-elsewhere · The street"); // unlocked elsewhere: place named
  });

  it("dims a scene that can't be started with no slots left, but still offers and rejects it", () => {
    const { term, core } = setup((s) => {
      s.place = "noodle_shop";
      s.scenesDone.intro = 1;
      s.trust.cook = 2;
      s.slot = 4; // slotsPerDay
    });
    const before = term.frames.at(-1)!;
    const line = before.find((l) => l.some((span) => span.text.includes("Serve drinks")))!;
    expect(line.map((span) => span.text).join("")).toContain("no time left");
    expect(line.find((span) => span.text.includes("Serve drinks"))?.dim).toBe(true);
    term.press("1"); // still selectable: choosing it gives the normal rejection
    expect(term.screen().join("\n")).toContain("You're out of time today. Sleep first.");
    expect(core.state.run).toBeNull();
  });

  it("names home on the sleep item when away from it, without dimming it", () => {
    const { term } = setup((s) => (s.place = "noodle_shop"), (c) => (c.world.home = "street"));
    const frame = term.frames.at(-1)!;
    const line = frame.find((l) => l.some((span) => span.text.includes("Sleep")))!;
    expect(line.map((span) => span.text).join("")).toContain("3) Sleep (end the day) — go home first (The street)");
    // Unlike a dimmed, out-of-time item, the sleep row itself isn't dimmed (only the frame's border is).
    expect(line.find((span) => span.text.includes("Sleep"))?.dim).toBeFalsy();
  });

  it("replaces a repeated identical rejection instead of piling it up", () => {
    const { term } = setup((s) => (s.place = "noodle_shop"), (c) => (c.world.home = "street"));
    term.press("3"); // sleep, away from home: rejected
    term.press("3"); // the same rejection again
    const s = term.screen().join("\n");
    expect(s.split("Head home first.").length - 1).toBe(1);
  });

  it("shows a different rejection normally after a repeated one", () => {
    const { term } = setup(
      (s) => {
        s.place = "noodle_shop";
        s.slot = 4; // slotsPerDay: nothing left today
      },
      (c) => (c.world.home = "street"),
    );
    term.press("3"); // sleep, away from home: rejected (not-home)
    term.press("3"); // the same rejection again: replaces, doesn't stack
    term.press("1"); // talking here with no slots left: a different rejection (no-slots)
    const s = term.screen().join("\n");
    expect(s).toContain("Head home first.");
    expect(s).toContain("You're out of time today. Sleep first.");
  });

  it("prints a place's name and description only the first time it's visited this session", () => {
    const { term } = setup();
    // The starting place (street) was already logged once at startup.
    expect(term.screen().join("\n").match(/Bikes and steam\./g)).toHaveLength(1);
    term.press("1"); // street -> noodle shop, first visit
    expect(term.screen().join("\n").match(/Steam everywhere\./g)).toHaveLength(1);
    term.press("2"); // noodle shop -> street, seen already: no new entry
    term.press("1"); // street -> noodle shop again: also no new entry
    const s = term.screen().join("\n");
    expect(s.match(/Bikes and steam\./g)).toHaveLength(1);
    expect(s.match(/Steam everywhere\./g)).toHaveLength(1);
  });
});
