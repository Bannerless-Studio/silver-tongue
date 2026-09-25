import { describe, expect, it } from "vitest";
import { fixtureCourse, line } from "@silver-tongue/core/testing";
import { checkCourse, orderScenes, type CheckInput } from "../src/check";

const LEARNER = [
  "place-street", "place-street-desc", "place-noodle_shop", "place-noodle_shop-desc",
  "npc-cook", "scene-intro", "scene-shift", "hud",
];

function input(patch: Partial<CheckInput> = {}): CheckInput {
  return {
    course: fixtureCourse(),
    stages: { "1": ["1"] },
    checks: { coverage: false, audio: false },
    learnerIds: new Set(LEARNER),
    requiredUi: ["hud"],
    ...patch,
  };
}

describe("checkCourse", () => {
  it("passes the fixture course", () => {
    expect(checkCourse(input())).toEqual([]);
  });

  it("orders scenes by `after` and reports cycles", () => {
    const c = fixtureCourse();
    expect(orderScenes([c.scenes[1], c.scenes[0]]).ordered.map((s) => s.id)).toEqual(["intro", "shift"]);
    const loop = { ...c.scenes[0], after: ["shift"] };
    expect(orderScenes([loop, c.scenes[1]]).errors[0]).toMatch(/cycle/);
  });

  it("allows at most 2 new words per exchange", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].npc = line(["你", "w_ni"], ["好", "w_hao"], ["茶", "w_cha"]);
    expect(checkCourse(input({ course: c }))).toContain("intro/greet: 3 new words (你 好 茶); at most 2");
  });

  it("rejects non-bonus words above the scene's stage", () => {
    const c = fixtureCourse();
    c.words.w_cha.lv = "2";
    expect(checkCourse(input({ course: c }))).toContain('intro/menu[item=tea]: "茶" is level 2, above stage 1');
  });

  it("checks references, reactions and learner text", () => {
    const c = fixtureCourse();
    c.scenes[0].npc = "ghost";
    delete c.reactions["wrong-generic"];
    const errors = checkCourse(input({ course: c, learnerIds: new Set() }));
    expect(errors).toContain('intro: unknown npc "ghost"');
    expect(errors).toContain('reactions: "wrong-generic" is required');
    expect(errors).toContain('learner text: missing "hud"');
  });

  it("enforces coverage and audio when the course turns them on", () => {
    const errors = checkCourse(input({ checks: { coverage: true, audio: true } }));
    expect(errors).toContain('coverage: "你" (stage 1) is in 1 scenes; needs 3');
    expect(errors).toContain("intro/greet: npc line has no audio");
  });

  it("doesn't count words from scenes that can be played in another order", () => {
    const c = fixtureCourse();
    // shift no longer comes after intro, so intro's words are new in shift.
    c.scenes[1].after = [];
    c.scenes[1].requires = {};
    expect(checkCourse(input({ course: c })).some((e) => /^shift\/order\[.*new words/.test(e))).toBe(true);
  });

  it("checks reactions against the earliest stage", () => {
    const c = fixtureCourse();
    c.scenes[1].stage = 2;
    c.words.w_cha.lv = "2";
    c.reactions["wrong-generic"] = line(["茶", "w_cha"]);
    const errors = checkCourse(input({ course: c, stages: { "1": ["1"], "2": ["2"] } }));
    expect(errors).toContain('reaction wrong-generic: "茶" is level 2, above stage 1');
  });

  it("keeps checking scenes stuck in a cycle", () => {
    const c = fixtureCourse();
    c.scenes[0].after = ["shift"];
    c.scenes[0].exchanges[0].variants[""].npc = line(["你", "w_ni"], ["好", "w_hao"], ["茶", "w_cha"]);
    const errors = checkCourse(input({ course: c }));
    expect(errors.some((e) => /cycle/.test(e))).toBe(true);
    expect(errors).toContain("intro/greet: 3 new words (你 好 茶); at most 2");
  });

  it("rejects duplicate ids and trust no earlier scene can give", () => {
    const c = fixtureCourse();
    c.scenes.push({ ...c.scenes[1] });
    c.scenes[0].exchanges.push(c.scenes[0].exchanges[0]);
    const errors = checkCourse(input({ course: c }));
    expect(errors).toContain('scenes: id "shift" is used twice');
    expect(errors).toContain('intro: exchange id "greet" is used twice');

    const d = fixtureCourse();
    d.scenes[1].requires = { trust: { cook: 3 } };
    d.scenes[1].repeatable = false;
    expect(checkCourse(input({ course: d }))).toContain('shift: needs trust 3 with "cook", but earlier scenes give at most 2');
  });

  it("keeps every tile and help word on keys 1-9", () => {
    const c = fixtureCourse();
    const long = line(...Array.from({ length: 10 }, () => ["好", "w_hao"] as [string, string]));
    c.scenes[0].exchanges[0].variants[""] = { npc: long, reply: line(...long.tokens.slice(0, 8).map(() => ["好", "w_hao"] as [string, string])) };
    const errors = checkCourse(input({ course: c }));
    expect(errors).toContain("intro/greet: the reply has 8 words; at most 7");
    expect(errors).toContain("intro/greet: the npc line has 10 words; at most 9");
  });

  it("keeps each place's menu on keys 1-7, before sleep and quit", () => {
    const c = fixtureCourse();
    c.world.places.noodle_shop.links = ["street", "a", "b", "c", "d", "e"];
    for (const l of ["a", "b", "c", "d", "e"]) c.world.places[l] = { links: [] };
    expect(checkCourse(input({ course: c }))).toContain('world: place "noodle_shop" has 8 scenes and exits; at most 7');
  });

  it("keeps names simple, groups sound, slot references real and amounts whole", () => {
    const c = fixtureCourse();
    c.groups.drinks = ["tea", "tea", "coffee"];
    c.groups["bad name"] = [];
    c.world.foodPerDay = 2.5;
    c.scenes[1].exchanges[0].pay = -1;
    c.scenes[1].exchanges[0].expect = { action: "serve", item: "$itme" };
    const errors = checkCourse(input({ course: c }));
    expect(errors).toContain('groups: "drinks" lists "tea" twice');
    expect(errors).toContain('groups: "drinks" has unknown concept "coffee"');
    expect(errors).toContain('groups: "bad name" may only use letters, digits, _ and -');
    expect(errors).toContain('groups: "bad name" is empty');
    expect(errors).toContain("world: foodPerDay must be a whole number of 0 or more");
    expect(errors).toContain("shift/order: pay must be a whole number of 0 or more");
    expect(errors).toContain('shift/order: expect uses unknown slot "$itme"');
  });

  it("needs a learner-language name for every concept", () => {
    const c = fixtureCourse();
    delete c.conceptNames.tea;
    expect(checkCourse(input({ course: c }))).toContain('concepts: no learner-language name for "tea"');
  });

  it("checks mentor notes: unique ids, known triggers, and their text", () => {
    const c = fixtureCourse();
    c.notes = [
      { id: "a", trigger: { word: "w_ni" } },
      { id: "a", trigger: { scene: "intro" } },
      { id: "b", trigger: { word: "w_nope" } },
      { id: "c", trigger: { scene: "nope" } },
    ];
    const ids = new Set([...LEARNER, "note-a", "note-a-title", "note-b", "note-b-title", "note-c"]);
    const errors = checkCourse(input({ course: c, learnerIds: ids }));
    expect(errors).toContain('notes: id "a" is used twice');
    expect(errors).toContain('notes: "b" is triggered by unknown word "w_nope"');
    expect(errors).toContain('notes: "c" is triggered by unknown scene "nope"');
    expect(errors).toContain('learner text: missing "note-c-title"');
  });

  it("checks the mentor's npc and the scene that unlocks them", () => {
    const c = fixtureCourse();
    c.world.mentor = { npc: "ghost", after: "nope" };
    const errors = checkCourse(input({ course: c }));
    expect(errors).toContain('world: mentor "ghost" is not an npc');
    expect(errors).toContain('world: mentor comes after unknown scene "nope"');
  });

  it("lets written wrong replies use only words the player has met", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].alts = [line(["茶", "w_cha"], ["！", null])];
    expect(checkCourse(input({ course: c }))).toContain('intro/greet: the wrong reply "茶！" uses words not met yet: 茶');
  });
});

