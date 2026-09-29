import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course, type GameState, type RenderedLine } from "@silver-tongue/core";
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
    expect(q.view().backlog.some((b) => b.restate?.rephrase === "rephrase" && b.speaker === "cook")).toBe(true);
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

  it("a word glosses once per transcript: a second reaction glosses nothing already glossed", () => {
    const { q, core } = setup();
    q.choose(0);
    q.choose(0);
    q.choose(wrongIndex(core));
    q.choose(wrongIndex(core));
    const reactions = q.view().backlog.filter((b) => b.tone === "react" && b.line);
    expect(reactions).toHaveLength(2);
    expect(reactions[0].fresh).toContain("w_bu");
    expect(reactions[1].fresh ?? []).toEqual([]); // 不 was glossed on the first reaction: no second gloss row
  });

  it("stage direction is narration; outcomes keep their tones", () => {
    const fresh = setup();
    expect(fresh.q.view().backlog.map((b) => b.tone)).toEqual(["narr", "narr"]); // the opening story
    fresh.q.choose(0);
    fresh.q.choose(0);
    const start = fresh.q.view().backlog.find((b) => b.text?.startsWith("The cook looks up"))!;
    expect(start.tone).toBe("narr");
    const { q, core } = fresh;
    while (q.view().phase.kind === "pick") q.choose(rightIndex(core));
    const end = q.view().backlog.find((b) => b.text === "She hands you an apron.")!;
    expect(end.tone).toBe("narr");
    expect(q.view().backlog.at(-1)!.tone).toMatch(/good|plain/); // the scene's outcome line
    const resumed = setup((s) => (s.day = 3));
    expect(resumed.q.view().backlog.map((b) => b.tone)).toEqual(["narr"]); // where the player is
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

  it("places a scene reveals are one toast, so they don't push other news out", () => {
    const { q, core } = setup(undefined, (c) => {
      for (const id of ["park", "school", "market"]) {
        c.world.places.street.links.push(id);
        c.world.places[id] = { links: ["street"], after: ["intro"] };
      }
    });
    q.choose(0);
    q.choose(0);
    for (let i = 0; core.state.run && i < 10; i++) q.choose(rightIndex(core));
    const news = q.view().toasts.filter((x) => x.text.startsWith("New place"));
    expect(news).toHaveLength(1);
    expect(news[0].text).toMatch(/^New places: .+, .+, .+$/);
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

  describe("a miss is one beat: echo, one narration line, the reaction saying the request again", () => {
    const shift = (s: GameState) => {
      s.scenesDone = { intro: 1 };
      s.trust = { cook: 1 };
      s.wallet = 50;
    };
    /** the transcript since `from`, as it reads: speaker, words, the request said again, any tag */
    const reads = (q: ReturnType<typeof setup>["q"], from: number) =>
      q.view().backlog.slice(from).map((b) =>
        [b.speaker && `${b.speaker}:`, b.text ?? b.line?.text, b.restate?.line.text, b.restate?.rephrase && `[${b.restate.rephrase}]`, b.cost && `${b.cost.amount}`]
          .filter(Boolean).join(" "));

    it("first miss: what was done and what was asked on one line; the reaction restates the request", () => {
      const { q, core } = setup(shift);
      q.choose(0);
      q.choose(0);
      const asked = q.view().lastLine!;
      const from = q.view().backlog.length;
      q.choose(wrongIndex(core));
      expect(reads(q, from)).toEqual([
        "player: 好，四杯水。 -2",
        "You set down four cups of water. They wanted four cups of tea.",
        "cook: 不是这个。 四杯茶。",
      ]);
      const [, told, react] = q.view().backlog.slice(from);
      expect(told.tone).toBe("react");
      expect(react).toMatchObject({ tone: "react", restate: { line: asked } });
      expect(react.restate!.fresh ?? []).toEqual([]); // the request's words were glossed when first said
      expect(q.view().lastLine).toBe(asked);
    });

    it("second miss: the rephrase rides on the reaction, never a separate line", () => {
      const { q, core } = setup(shift);
      q.choose(0);
      q.choose(0);
      q.choose(wrongIndex(core));
      const from = q.view().backlog.length;
      q.choose(wrongIndex(core));
      expect(reads(q, from)).toEqual([
        "player: 好，四杯水。 -2",
        "You set down four cups of water. They wanted four cups of tea.",
        "cook: 不是这个。 茶。四杯。 [rephrase]",
      ]);
      expect(q.view().backlog.some((b) => b.rephrase)).toBe(false);
      expect(q.view().lastLine?.text).toBe("茶。四杯。");
    });

    it("second miss with no authored rephrase: the same request, said slower, on the reaction", () => {
      const { q, core } = setup();
      q.choose(0);
      q.choose(0);
      q.choose(rightIndex(core));
      q.choose(wrongIndex(core));
      const from = q.view().backlog.length;
      q.choose(wrongIndex(core));
      const rows = reads(q, from);
      expect(rows).toHaveLength(3);
      expect(rows[2]).toBe("cook: 不是这个。 水。 [slower]");
    });

    it("a scene with no action narration: the italic line is just what was asked", () => {
      const { q, core } = setup(undefined, (c) => {
        c.learnerFtl = c.learnerFtl.replace(/^action-repeat = .*$/m, "") + "\nasked-repeat = The cook was asking for { $item }.\n";
      });
      q.choose(0);
      q.choose(0);
      q.choose(rightIndex(core));
      const from = q.view().backlog.length;
      q.choose(wrongIndex(core));
      expect(reads(q, from)).toEqual(["player: 茶？ -1", "The cook was asking for water.", "cook: 不是这个。 水。"]);
    });

    it("a miss plays the reaction's clip only, plus the rephrase's; never the request again", () => {
      const played: Speech[][] = [];
      const audio: AudioOut = { available: true, play: (l) => void played.push(l), stop: () => {} };
      const { q, core } = setup(shift, (c) => {
        for (const sc of c.scenes) for (const ex of sc.exchanges) for (const v of Object.values(ex.variants)) {
          v.npc.audio = ["ask.mp3"];
          if (v.rephrase) v.rephrase.audio = ["rephrase.mp3"];
        }
        c.reactionAudio = new Proxy({}, { get: () => ({ cook: ["react.mp3"] }) });
      }, { audio });
      q.choose(0);
      q.choose(0);
      q.choose(wrongIndex(core));
      expect(played.at(-1)!.flatMap((s) => s.clips)).toEqual(["react.mp3"]);
      q.choose(wrongIndex(core));
      expect(played.at(-1)!.flatMap((s) => s.clips)).toEqual(["react.mp3", "rephrase.mp3"]);
    });

    it("a right reply is unchanged: the echo, what was done, then what comes next", () => {
      const job = setup(shift);
      job.q.choose(0);
      job.q.choose(0);
      const from = job.q.view().backlog.length;
      job.q.choose(rightIndex(job.core));
      expect(reads(job.q, from).slice(0, 2)).toEqual(["player: 好，四杯茶。", "You set down four cups of tea."]);
      expect(job.q.view().backlog[from + 1].tone).toBe("narr");
      const social = setup();
      social.q.choose(0);
      social.q.choose(0);
      social.q.choose(rightIndex(social.core));
      const at = social.q.view().backlog.length;
      social.q.choose(rightIndex(social.core));
      const rows = social.q.view().backlog.slice(at);
      expect(rows[0]).toMatchObject({ speaker: "player" });
      expect(rows.some((b) => b.tone === "react" || b.restate)).toBe(false);
    });
  });

  it("an option's intent shows only when the options' intents differ and a word in it is not known yet", () => {
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };
    const { q } = setup((s) => (s.words.w_hao = { ...known }));
    const tk = (word: string) => ({ word, start: 0, end: 1 });
    const line = (text: string, words: string[], intent?: string) => ({ text, tokens: words.map(tk), ...(intent ? { intent } : {}) }) as unknown as RenderedLine;
    const social = [line("你好", ["w_ni", "w_hao"], "Greet"), line("好", ["w_hao"], "Agree")];
    expect(social.map((o) => q.intentShown(social, o))).toEqual([true, false]); // 好 alone is known
    const job = [line("四杯茶", ["w_si"], "Repeat the job"), line("三杯茶", ["w_san"], "Repeat the job")];
    expect(job.map((o) => q.intentShown(job, o))).toEqual([false, false]);
    const some = [line("你", ["w_ni"], "Point"), line("不", ["w_bu"])];
    expect(some.map((o) => q.intentShown(some, o))).toEqual([true, false]);
    // A lone option has no other intent to differ from: it shows while a word in it is not known.
    const lone = [line("你好", ["w_ni", "w_hao"], "Greet")];
    expect(q.intentShown(lone, lone[0])).toBe(true);
    const loneKnown = [line("好", ["w_hao"], "Agree")];
    expect(q.intentShown(loneKnown, loneKnown[0])).toBe(false);
  });

  it("a reply known word for word is typed, without hints; dots look confused", () => {
    const shift = ["w_cha", "w_shui", "w_san", "w_si", "w_hao", "x_bei"];
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };
    const inShift = () =>
      setup(
        (s) => {
          s.place = "noodle_shop";
          s.scenesDone = { intro: 1 };
          s.trust = { cook: 2 };
          s.words = Object.fromEntries(shift.map((w) => [w, { ...known }]));
        },
        (c) => (c.typing = true),
      );
    const { q } = inShift();
    q.choose(0);
    const p = q.view().phase;
    expect(p).toMatchObject({ kind: "type", confused: true });
    q.sendText("...");
    expect(texts(q).at(-2)).toBe("...");
    expect(q.view().phase.kind).toBe("pick");

    const again = inShift();
    again.q.choose(0);
    const reply = again.course.scenes[1].exchanges[0].variants[comboKey(again.core.state.run!.combo)].reply.text;
    again.q.sendText(reply);
    expect(again.q.view().backlog.some((b) => b.speaker === "player" && b.text === reply)).toBe(true);
    expect(again.core.state.run).toBeNull();
  });
});
