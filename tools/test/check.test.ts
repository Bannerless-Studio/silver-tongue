import { describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { addErrand, fixtureCourse, line } from "@silver-tongue/core/testing";
import { checkCourse, orderScenes, type CheckInput } from "../src/check";

const LEARNER = [
  "place-street", "place-street-desc", "place-noodle_shop", "place-noodle_shop-desc",
  "npc-cook", "scene-intro", "scene-shift", "hud",
  "asked-greet", "asked-repeat", "asked-serve",
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
  describe("errands", () => {
    const ERRAND_IDS = ["scene-pickup", "scene-drop", "scene-drop2", "place-school", "place-school-desc", "npc-teacher", "asked-deliver"];
    const run = (change: (c: ReturnType<typeof fixtureCourse>) => void = () => {}) => {
      const c = addErrand(fixtureCourse());
      change(c);
      return checkCourse(input({ course: c, learnerIds: new Set([...LEARNER, ...ERRAND_IDS]) }));
    };

    it("passes a pickup with one drop-off at each place it can name", () => {
      expect(run()).toEqual([]);
    });

    it("rejects an errand slot that names something other than a place", () => {
      expect(run((c) => (c.scenes[2].startsErrand = "$nope"))).toContain('pickup: startsErrand "$nope" is not a slot of any exchange');
      expect(
        run((c) => {
          c.groups.dests = ["school", "tea"];
          const ex = c.scenes[2].exchanges[0];
          ex.variants["to=tea"] = structuredClone(ex.variants["to=school"]);
        }),
      ).toContain('pickup: errand goes to "tea", which is not a place');
    });

    it("needs exactly one drop-off at each destination, and no drop-off nobody sends parcels to", () => {
      expect(run((c) => void c.scenes.pop())).toContain('pickup: errand goes to "school", which has no scene that ends an errand');
      expect(run((c) => void c.scenes.push({ ...structuredClone(c.scenes[3]), id: "drop2" }))).toContain(
        'pickup: errand goes to "school", which has 2 scenes that end an errand; needs 1',
      );
      expect(run((c) => void delete c.scenes[2].startsErrand)).toContain('drop: ends an errand, but no errand goes to "school"');
    });

    it("keeps a parcel deliverable: pickups and drop-offs repeat, and a drop-off needs nothing the pickup doesn't", () => {
      expect(run((c) => void (c.scenes[3].repeatable = false))).toContain("drop: ends an errand, so it must be repeatable");
      expect(run((c) => void (c.scenes[2].repeatable = false))).toContain("pickup: starts an errand, so it must be repeatable");
      expect(run((c) => void (c.scenes[3].requires = { trust: { teacher: 1 } }))).toContain(
        "drop: ends an errand, so it may not require trust (a parcel could never be delivered)",
      );
      expect(run((c) => void (c.scenes[3].after = ["pickup", "shift"]))).toContain(
        'drop: comes after "shift", which a parcel from pickup doesn\'t need; a parcel could never be delivered',
      );
    });
  });

  it("passes the fixture course", () => {
    expect(checkCourse(input())).toEqual([]);
  });

  it("needs a whole-number cost", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].cost = -1;
    expect(checkCourse(input({ course: c }))).toContain("intro/greet: cost must be a whole number of 0 or more");
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

  it("keeps a slot that has its own reaction to one group", () => {
    // Reactions are chosen by slot name (wrong-<slot>) across the whole course.
    const c = fixtureCourse();
    c.reactions["wrong-item"] = line(["不", "w_bu"], ["是", "w_shi"], ["。", null]);
    expect(checkCourse(input({ course: c }))).toEqual([]);
    c.groups.hot = ["tea"];
    c.scenes[0].exchanges[1].slots = { item: "hot" };
    expect(checkCourse(input({ course: c }))).toContain('reactions: "wrong-item" answers slot "item", which draws from drinks and hot; give one of them another slot name');
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

  it("counts the player's name as a tile of the reply", () => {
    const c = fixtureCourse();
    const w = ["你", "w_ni"] as [string, string];
    c.scenes[0].exchanges[0].variants[""].reply = line(w, w, w, w, w, w, w, [PLAYER_MARK, null]);
    expect(checkCourse(input({ course: c }))).toContain("intro/greet: the reply has 8 words; at most 7");
  });

  it("keeps each place's menu on keys 1-7, before sleep and quit", () => {
    const c = fixtureCourse();
    c.world.places.noodle_shop.links = ["street", "a", "b", "c", "d", "e"];
    for (const l of ["a", "b", "c", "d", "e"]) c.world.places[l] = { links: [] };
    expect(checkCourse(input({ course: c }))).toContain('world: place "noodle_shop" has 8 menu items; at most 7');
  });

  it("needs an asked- line for every action a scene uses", () => {
    const learnerIds = new Set(LEARNER.filter((id) => id !== "asked-serve"));
    expect(checkCourse(input({ learnerIds }))).toContain('narration: no "asked-serve" line (used by shift)');
  });

  it("needs home to be a place", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    expect(checkCourse(input({ course: c }))).toEqual([]);
    c.world.home = "attic";
    expect(checkCourse(input({ course: c }))).toContain('world: home "attic" is not a place');
  });

  it("needs home to be reachable from every place, so every day can end", () => {
    const c = fixtureCourse();
    c.world.places.attic = { links: ["street"] };
    c.world.home = "attic";
    const errors = checkCourse(input({ course: c }));
    expect(errors).toContain('world: home "attic" can\'t be reached from "street"');
    expect(errors).toContain('world: home "attic" can\'t be reached from "noodle_shop"');
  });

  it("counts the mentor's visit in their place's menu", () => {
    const c = fixtureCourse();
    // 2 scenes + 5 exits = 7: allowed, until the mentor sits here too.
    const extra = ["a", "b", "c", "d"];
    c.world.places.noodle_shop.links = ["street", ...extra];
    for (const l of extra) c.world.places[l] = { links: [] };
    const learnerIds = new Set([...LEARNER, ...extra.flatMap((l) => [`place-${l}`, `place-${l}-desc`])]);
    expect(checkCourse(input({ course: c, learnerIds }))).toEqual([]);
    c.world.mentor = { npc: "cook", after: "intro" };
    expect(checkCourse(input({ course: c, learnerIds }))).toContain('world: place "noodle_shop" has 8 menu items; at most 7');
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

