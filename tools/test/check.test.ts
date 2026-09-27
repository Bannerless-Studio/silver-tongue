import { describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { addErrand, fixtureCourse, line } from "@silver-tongue/core/testing";
import { checkCourse, newWordLimit, orderScenes, usedWords, type CheckInput } from "../src/check";
import { assignAudio } from "../src/voices";

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

  it("needs every slot a reply is graded on to show in the reply", () => {
    const c = fixtureCourse();
    for (const v of Object.values(c.scenes[0].exchanges[1].variants)) v.reply = line(["好", "w_hao"], ["？", null]);
    expect(checkCourse(input({ course: c }))).toContain('intro/menu: hinge "$item" doesn\'t change the reply, so a player can\'t get it wrong');
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

  it("allows an early scene (few words met) up to 4 new words per exchange", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].npc = line(
      ["你", "w_ni"],
      ["好", "w_hao"],
      ["茶", "w_cha"],
      ["水", "w_shui"],
      ["三", "w_san"],
    );
    expect(checkCourse(input({ course: c }))).toContain("intro/greet: 5 new words (你 好 茶 水 三); at most 4");
  });

  describe("newWordLimit", () => {
    it("grades the default by words met so far: 4 below 30, 3 below 60, then the ratio", () => {
      expect(newWordLimit(0, 3)).toBe(4);
      expect(newWordLimit(29, 3)).toBe(4);
      expect(newWordLimit(30, 3)).toBe(3);
      expect(newWordLimit(59, 3)).toBe(3);
      expect(newWordLimit(60, 3)).toBe(2); // floor(0.6) = 0, so the floor of 2 wins
      expect(newWordLimit(60, 10)).toBe(2); // floor(2) = 2, ties the floor
      expect(newWordLimit(60, 20)).toBe(4); // floor(4) = 4, above the floor
      expect(newWordLimit(60, 21)).toBe(4); // floor(4.2) = 4
    });

    it("a scene override replaces the band or ratio entirely, even below the usual floor", () => {
      expect(newWordLimit(0, 3, 1)).toBe(1);
      expect(newWordLimit(60, 20, 6)).toBe(6);
      expect(newWordLimit(0, 3, 0)).toBe(0);
    });
  });

  it("a scene's newWordsOverride replaces the ratio limit in checkCourse", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].npc = line(["你", "w_ni"], ["好", "w_hao"], ["茶", "w_cha"]);
    expect(checkCourse(input({ course: c, newWordsOverride: { intro: 1 } }))).toContain("intro/greet: 3 new words (你 好 茶); at most 1");
    expect(checkCourse(input({ course: c, newWordsOverride: { intro: 5 } }))).toEqual([]);
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

  it("enforces coverage when the course turns it on", () => {
    const errors = checkCourse(input({ checks: { coverage: true, audio: false } }));
    expect(errors).toContain('coverage: "你" (stage 1) is in 1 scenes; needs 3');
  });

  describe("audio", () => {
    const AUDIO = { coverage: false, audio: true };
    const voiced = () => {
      const c = fixtureCourse();
      const clips = assignAudio(c, { engine: "edge-tts", player: "P", words: "W", npcs: { cook: "C" } }, usedWords(c));
      return { c, files: new Set(clips.map((x) => x.id)) };
    };

    it("reports lines, words and reactions without clips", () => {
      const errors = checkCourse(input({ checks: AUDIO }));
      expect(errors).toContain("intro/greet: npc line has no audio");
      expect(errors).toContain("intro/greet: alt1 line has no audio");
      expect(errors).toContain('word w_ni "你": no audio');
      expect(errors).toContain("reaction wrong-generic: no audio for cook");
    });

    it("passes when every clip has a file, and names a clip without one", () => {
      const { c, files } = voiced();
      expect(checkCourse(input({ course: c, checks: AUDIO, audioFiles: files }))).toEqual([]);
      const [gone] = files;
      files.delete(gone);
      expect(checkCourse(input({ course: c, checks: AUDIO, audioFiles: files }))).toEqual([`audio: no file for clip ${gone}`]);
    });

    it("lets a line that is only the player's name go without clips", () => {
      const { c, files } = voiced();
      const v = c.scenes[0].exchanges[0].variants[""];
      v.alts![0] = { text: `${PLAYER_MARK}？`, tokens: [], audio: [] };
      expect(checkCourse(input({ course: c, checks: AUDIO, audioFiles: files }))).toEqual([]);
      v.alts![0] = { text: `${PLAYER_MARK}？`, tokens: [] };
      expect(checkCourse(input({ course: c, checks: AUDIO, audioFiles: files }))).toEqual(["intro/greet: alt1 line has no audio"]);
    });

    it("counts the words of every line, reaction and concept as used", () => {
      const c = fixtureCourse();
      expect([...usedWords(c)].sort()).toEqual(["w_bu", "w_cha", "w_ge", "w_hao", "w_ni", "w_san", "w_shi", "w_shui", "w_si", "w_zhe", "x_bei"]);
    });
  });

  it("doesn't count words from scenes that can be played in another order", () => {
    const c = fixtureCourse();
    // shift no longer comes after intro, so intro's words are new in shift.
    c.scenes[1].after = [];
    c.scenes[1].requires = {};
    // A tight override isolates this from the graded default's leniency band, which the tiny
    // fixture vocabulary would otherwise never exceed.
    expect(
      checkCourse(input({ course: c, newWordsOverride: { shift: 1 } })).some((e) => /^shift\/order\[.*new words/.test(e)),
    ).toBe(true);
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
    c.scenes[0].exchanges[0].variants[""].npc = line(
      ["你", "w_ni"],
      ["好", "w_hao"],
      ["茶", "w_cha"],
      ["水", "w_shui"],
      ["三", "w_san"],
    );
    const errors = checkCourse(input({ course: c }));
    expect(errors.some((e) => /cycle/.test(e))).toBe(true);
    expect(errors).toContain("intro/greet: 5 new words (你 好 茶 水 三); at most 4");
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

