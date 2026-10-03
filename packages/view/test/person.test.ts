import { describe, expect, it } from "vitest";
import { newGame, type WordRecord } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { makeText, peopleList, personView } from "../src/index";

const T0 = 1_000_000;
const setup = () => {
  const course = fixtureWithText();
  course.learnerFtl += "\nnpc-cook-desc = Runs the noodle shop.\n";
  return { course, state: newGame(course), t: makeText(course.learnerFtl, "en") };
};
const rec = (right: number, lapsed = false): WordRecord => ({ right, wrong: lapsed ? 1 : 0, streak: right, helps: 0, lapsed, firstSeen: T0, lastSeen: T0 });

describe("people", () => {
  it("lists the people met, with trust, and the rest after them", () => {
    const { course, state, t } = setup();
    expect(peopleList(course, state, t)).toEqual({ met: [], unmet: [{ npc: "cook", name: "Cook", place: "Noodle shop", trust: 0 }] });
    state.scenesDone.intro = 1;
    state.trust.cook = 9;
    expect(peopleList(course, state, t)).toEqual({ met: [{ npc: "cook", name: "Cook", place: "Noodle shop", trust: 5 }], unmet: [] });
  });
});

describe("a person's page", () => {
  it("says who they are, and for someone not met yet, where to find them and how to meet them", () => {
    const { course, state, t } = setup();
    const p = personView(course, state, t, "cook", T0);
    expect(p).toMatchObject({ name: "Cook", place: "Noodle shop", desc: "Runs the noodle shop.", met: false, where: "where: Noodle shop" });
    expect(p.tips.map((x) => [x.label, x.open])).toEqual([["Say hello", true], ["Serve drinks", false]]);
    expect(p.tips[1].needs).toEqual([{ text: "after Say hello", done: false }, { text: "trust 1", done: false }]);
    expect(p.tips[1]).toMatchObject({ repeat: true, gains: "+1 trust · +¥3" });
  });

  it("drops a conversation had once, keeps work that can be had again, and puts what's open first", () => {
    const { course, state, t } = setup();
    state.scenesDone.intro = 1;
    state.trust.cook = 1;
    const p = personView(course, state, t, "cook", T0);
    expect(p.where).toBeUndefined();
    expect(p.tips).toEqual([{ label: "Serve drinks", repeat: true, open: true, gains: "+1 trust · +¥3", needs: [{ text: "trust 1", done: true }] }]);
  });

  it("rebuilds the conversations kept, newest first, with the part of the day they were had in", () => {
    const { course, state, t } = setup();
    state.player = "Mei";
    state.scenesDone = { intro: 1, shift: 1 };
    state.talks = [
      { scene: "intro", day: 1, slot: 1, keys: ["", "item=tea"], earned: 0 },
      { scene: "shift", day: 2, slot: 3, keys: ["count=four|item=water"], earned: 3 },
    ];
    const talks = personView(course, state, t, "cook", T0).talks;
    expect(talks.map((x) => [x.title, x.day, x.part, x.earned])).toEqual([["Serve drinks", 2, "afternoon", 3], ["Say hello", 1, "morning", 0]]);
    const v = course.scenes[1].exchanges[0].variants["count=four|item=water"];
    expect(talks[0].lines).toEqual([
      { who: "npc", text: v.npc.text, meaning: v.npc.meaning ?? "" },
      { who: "player", text: v.reply.text, meaning: v.reply.meaning ?? "" },
    ]);
    expect(talks[1].lines).toHaveLength(4);
  });

  it("shows the written wrong reply a player got through with, and the answer to it", () => {
    const { course, state, t } = setup();
    const greet = course.scenes[0].exchanges[0].variants[""];
    const answer = { text: "好。", tokens: [], meaning: "Fine." };
    greet.altOutcomes = { "0": { accept: true, reaction: answer } };
    state.scenesDone.intro = 1;
    state.talks = [{ scene: "intro", day: 1, slot: 1, keys: ["", "item=tea"], alts: { "0": 0 }, earned: 0 }];
    const lines = personView(course, state, t, "cook", T0).talks[0].lines;
    expect(lines.slice(0, 3)).toEqual([
      { who: "npc", text: greet.npc.text, meaning: greet.npc.meaning ?? "" },
      { who: "player", text: greet.alts![0].text, meaning: greet.alts![0].meaning ?? "" },
      { who: "npc", text: "好。", meaning: "Fine." },
    ]);
    expect(lines).toHaveLength(5);
  });

  it("splits their words into heard, marking the shaky ones, and not yet", () => {
    const { course, state, t } = setup();
    state.words = { w_ni: rec(3), w_hao: rec(0, true) };
    const { heard, notYet } = personView(course, state, t, "cook", T0).words;
    expect(heard.map((w) => [w.word, w.shaky])).toEqual([["w_ni", false], ["w_hao", true]]);
    expect(notYet.map((w) => w.word)).not.toContain("w_ni");
    expect(notYet.length).toBeGreaterThan(0);
  });
});
