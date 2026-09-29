import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { buildAll, buildCourse, languageNameProblems, writeCourses } from "../src/build-course";
import { clipId, type Voices } from "../src/voices";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** A copy of the real content after `change` edits it. */
function copyContent(change: (dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "st-content-"));
  temps.push(dir);
  // The clips are ~10 MB: link them instead of copying them for every test.
  const audio = join(CONTENT, "audio");
  cpSync(CONTENT, dir, { recursive: true, filter: (src) => src !== audio });
  if (existsSync(audio)) symlinkSync(audio, join(dir, "audio"));
  change(dir);
  return dir;
}

/** Builds a copy of the real content after `change` edits it. */
function buildChanged(change: (dir: string) => void) {
  return buildCourse(copyContent(change), "zh-china");
}

const INTRO = "languages/zh/lines/noodle-intro.ftl";

describe("build-course (real content)", () => {
  const { course, errors } = buildCourse(CONTENT, "zh-china");
  const voices = JSON.parse(readFileSync(join(CONTENT, "languages/zh/voices.json"), "utf8")) as Voices;

  it("gives every line, word and reaction its clips, in the speaker's voice", () => {
    const v = course!.scenes.find((s) => s.id === "noodle-shift")!.exchanges[1].variants["count=four|item=water"];
    expect(v.npc.audio).toEqual([clipId("zh-CN-XiaoxiaoNeural", "四杯水。")]);
    expect(v.rephrase!.audio).toEqual([clipId("zh-CN-XiaoxiaoNeural", "水。四杯。")]);
    expect(v.reply.audio).toEqual([clipId("zh-CN-YunxiNeural", "好，四杯水。")]);
    expect(Object.values(course!.words).every((w) => w.audio?.length === 1)).toBe(true);
    expect(course!.reactionAudio!["wrong-generic"].wang).toEqual([clipId("zh-CN-YunyangNeural", course!.reactions["wrong-generic"].text)]);
    expect(Object.keys(course!.reactionAudio!["wrong-generic"]).sort()).toEqual([...new Set(course!.scenes.map((s) => s.npc))].sort());
  });

  it("says a line with the player's name as the part before it and the part after it", () => {
    const named = course!.scenes.flatMap((s) =>
      s.exchanges.flatMap((ex) => Object.values(ex.variants).map((v) => ({ npc: s.npc, line: v.npc }))),
    ).find(({ line }) => line.text.includes(PLAYER_MARK) && !line.text.startsWith(PLAYER_MARK))!;
    const [before, after] = named.line.text.split(PLAYER_MARK);
    const voice = voices.npcs[named.npc];
    expect(named.line.audio![0]).toBe(clipId(voice, before));
    if (/\p{L}/u.test(after)) expect(named.line.audio).toEqual([clipId(voice, before), clipId(voice, after)]);
  });

  it("builds zh-china with no errors", () => {
    expect(errors).toEqual([]);
    expect(course!.scenes.map((s) => s.id)).toEqual(["class-break", "class-first", "class-read", "class-write", "delivery-hospital", "delivery-intro", "delivery-pickup", "delivery-school", "delivery-station", "hospital-checkup", "noodle-bowl", "noodle-intro", "noodle-kitchen", "noodle-lunch", "noodle-shift", "room-hello", "room-phone", "room-rent", "shop-buy", "shop-intro", "stairs-family", "stairs-meet", "stairs-pets", "street-hello", "street-hungry", "street-numbers", "street-practice", "taxi-luggage", "taxi-visitor", "taxi-way", "tea-intro", "tea-shift", "tea-tv", "tea-weather", "warehouse-intro", "warehouse-shift"]);
  });

  it("renders every slot combination and tags its words", () => {
    const order = course!.scenes.find((s) => s.id === "noodle-shift")!.exchanges[1];
    expect(Object.keys(order.variants)).toHaveLength(6);
    const v = order.variants["count=four|item=water"];
    expect(v.npc.text).toBe("四杯水。");
    expect(v.npc.tokens.map((t) => course!.words[t.word].w)).toEqual(["四", "杯", "水"]);
    expect(v.reply.text).toBe("好，四杯水。");
    expect(v.rephrase?.text).toBe("水。四杯。");
  });

  it("gives every line its meaning in the learner's language", () => {
    const v = course!.scenes.find((s) => s.id === "noodle-shift")!.exchanges[1].variants["count=four|item=water"];
    expect(v.npc.meaning).toBe("Four cups of water.");
    expect(v.reply.meaning).toBe("OK, four cups of water.");
    expect(v.rephrase?.meaning).toBe("Water. Four cups.");
    expect(course!.reactions["wrong-count"].meaning).toBe("How many cups?");
  });

  it("says what every reply and written wrong reply does, in every course", () => {
    const v = course!.scenes.find((s) => s.id === "noodle-shift")!.exchanges[1].variants["count=four|item=water"];
    expect(v.reply.intent).toBe("Repeat the order");
    for (const id of ["zh-china", "ja-japan"]) {
      const c = buildCourse(CONTENT, id).course!;
      const missing = c.scenes.flatMap((sc) =>
        sc.exchanges.flatMap((ex) =>
          Object.values(ex.variants).flatMap((vr) => [vr.reply, ...(vr.alts ?? [])].filter((l) => !l.intent).map((l) => `${sc.id}/${ex.id}: ${l.text}`)),
        ),
      );
      expect(missing).toEqual([]);
      // What a reply does, not what it says: an intent naming the slot's value ("Tea") gives the answer away.
      const telling = c.scenes.flatMap((sc) =>
        sc.exchanges.filter((ex) => new Set(Object.values(ex.variants).map((vr) => vr.reply.intent)).size > 1).map((ex) => `${sc.id}/${ex.id}`),
      );
      expect(telling).toEqual([]);
    }
  });

  it("names concepts in the learner's language, lists the stage words, and loads the mentor notes", () => {
    expect(course!.conceptNames.tea).toBe("tea");
    expect(course!.conceptNames.thanks).toBe("Thank you");
    expect(course!.stageWords["1"]).toHaveLength(149); // HSK 1 but 电脑
    expect(course!.notes.map((n) => n.id)).toEqual(["hao-ma", "lao-xiao", "le", "bukeqi", "bei", "ge", "kuai", "nali", "de", "dian", "mei", "tai", "hui-neng", "zai"]);
    expect(course!.world.mentor).toEqual({ npc: "wang", after: "street-hello" });
    expect(course!.learnerFtl).toContain("note-bei-title");
  });

  it("gives every scene its own name, so an unlock line says which one opened", () => {
    // Drop-offs are never announced, and only one is ever on offer, so they may share a name.
    const names = course!.scenes.filter((sc) => !sc.endsErrand).map((sc) => course!.learnerFtl.match(new RegExp(`^scene-${sc.id} = (.*)$`, "m"))![1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("Mr Li talks about rent after your first warehouse shift, and Old Wang explains 个 and 块", () => {
    expect(course!.scenes.find((s) => s.id === "room-rent")!.after).toEqual(["room-hello", "warehouse-shift"]);
    expect(course!.notes.map((n) => n.id)).toEqual(expect.arrayContaining(["ge", "kuai"]));
  });

  it("the warehouse shift counts from three to ten, in its own slot", () => {
    const shift = course!.scenes.find((s) => s.id === "warehouse-shift")!;
    const carry = shift.exchanges.find((ex) => ex.id === "carry")!;
    // Not `count`: that slot's reaction is the noodle shop's 几杯？
    expect(carry.slots).toEqual({ amount: "numbers_3_10", item: "furniture" });
    // English says "{amount} {item}s", so no amount may be one or two.
    expect(course!.groups.numbers_3_10).toEqual(["three", "four", "five", "six", "seven", "eight", "nine", "ten"]);
    expect(shift.exchanges.every((ex) => ex.pay > 0)).toBe(true);
  });

  it("Big Liu counts you from six to ten, after you can count to five", () => {
    const intro = course!.scenes.find((s) => s.id === "warehouse-intro")!;
    expect(intro.after).toEqual(["street-numbers"]);
    const heard = intro.exchanges.flatMap((ex) => ex.variants[""].npc.tokens.map((t) => course!.words[t.word].w));
    for (const n of ["六", "七", "八", "九", "十"]) expect(heard).toContain(n);
  });

  it("Big Liu asks if you want to work (想), not if you know how (会)", () => {
    const job = course!.scenes.find((s) => s.id === "warehouse-intro")!.exchanges.find((ex) => ex.id === "job")!;
    expect(job.variants[""].npc.text).toContain("想工作");
  });

  it("the note on 个 says which measure words chairs and tables really take", () => {
    const note = course!.learnerFtl.match(/^note-ge = (.*)$/m)![1];
    expect(note).toContain("把");
    expect(note).toContain("张");
  });

  it("turns the art check on", () => {
    expect(JSON.parse(readFileSync(join(CONTENT, "courses/zh-china.json"), "utf8")).checks.art).toBe(true);
  });

  it("turns the audio check on", () => {
    expect(JSON.parse(readFileSync(join(CONTENT, "courses/zh-china.json"), "utf8")).checks.audio).toBe(true);
  });

  it("turns the HSK 1 coverage check on", () => {
    const cfg = JSON.parse(readFileSync(join(CONTENT, "courses", "zh-china.json"), "utf8"));
    expect(cfg.checks.coverage).toBe(true);
  });

  it("adds the tea house off Station Road and the stairwell off your room", () => {
    const { places, npcs } = course!.world;
    expect(places.tea_house.links).toEqual(["station_road"]);
    expect(places.station_road.links).toContain("tea_house");
    expect(places.stairs.links).toEqual(["room"]);
    expect(npcs.teaboss.place).toBe("tea_house");
    expect(npcs.neighbour.place).toBe("stairs");
    expect(npcs.classmate.place).toBe("school");
    expect(npcs.driver.place).toBe("station");
  });

  it("pays for the new jobs, and the luggage goes into or out of the taxi", () => {
    const tea = course!.scenes.find((s) => s.id === "tea-shift")!;
    const taxi = course!.scenes.find((s) => s.id === "taxi-luggage")!;
    expect(tea.repeatable && taxi.repeatable).toBe(true);
    expect(tea.exchanges.reduce((n, ex) => n + ex.pay, 0)).toBeGreaterThan(0);
    expect(taxi.exchanges[0].variants["amount=three|way=board"].reply.text).toContain("上出租车");
    expect(taxi.exchanges[0].variants["amount=three|way=alight"].reply.text).toContain("下出租车");
  });

  it("puts your room on Main Street, known from the start, and the only place to sleep", () => {
    const { places, home, homeScene } = course!.world;
    expect(home).toBe("room");
    // No home scene: the room is yours from the first night, so there's no sleeping rough.
    expect(homeScene).toBeUndefined();
    expect(places.street.links).toEqual(["noodle_shop", "room", "market"]);
    expect(places.room.links).toEqual(["street", "stairs"]);
    expect(places.room.after ?? []).toEqual([]);
    expect([...places.market.links].sort()).toEqual(["shop", "station_road", "street", "warehouse"]);
    expect(course!.learnerFtl.match(/^intro-2 = (.*)$/m)![1]).toContain("a room for you down the street");
  });

  it("Miss Gao sends parcels to the three places on Station Road, each with one drop-off", () => {
    const pickup = course!.scenes.find((s) => s.id === "delivery-pickup")!;
    expect(pickup.startsErrand).toBe("$place");
    expect(course!.groups.destinations).toEqual(["hospital", "school", "station"]);
    for (const p of course!.groups.destinations) {
      expect(course!.world.places.station_road.links).toContain(p);
      expect(course!.scenes.filter((s) => s.endsErrand && s.place === p).map((s) => s.id)).toEqual([`delivery-${p}`]);
    }
    expect(course!.scenes.find((s) => s.id === "delivery-intro")!.after).toEqual(["warehouse-shift", "room-hello"]);
  });

  it("the shop sells at the price you agreed, and the kitchen comes after deliveries", () => {
    const buy = course!.scenes.find((s) => s.id === "shop-buy")!;
    expect(buy.exchanges[0].variants["item=apple|price=four"].cost).toBe(4);
    // the course carries only the resolved price per variant, never the skeleton's "$price"
    expect(buy.exchanges[0].cost).toBeUndefined();
    const intro = course!.scenes.find((s) => s.id === "shop-intro")!;
    expect(intro.exchanges.find((ex) => ex.id === "less")!.variants[""].cost).toBe(4);
    expect(course!.scenes.find((s) => s.id === "noodle-kitchen")!.after).toEqual(["noodle-shift", "delivery-pickup"]);
  });

  it("the staff lunch names 菜 as vegetables, not dishes (you're washing the dishes)", () => {
    expect(course!.groups.foods).toEqual(["rice", "vegetables", "noodles"]);
    expect(course!.conceptNames.vegetables).toBe("vegetables");
  });

  it("the cook offers work only once Old Wang has taught you to count", () => {
    // Otherwise she hands you an apron and no shift appears, with nothing to say why.
    expect(course!.scenes.find((s) => s.id === "noodle-intro")!.after).toContain("street-numbers");
  });

  it("the noodle shop opens once Old Wang points you to it, for a bowl of noodles; work waits for counting", () => {
    expect(course!.world.places.noodle_shop.after).toEqual(["street-hungry"]);
    expect(course!.scenes.find((s) => s.id === "noodle-bowl")!.after).toEqual(["street-hungry"]);
  });

  it("a wrong number while counting with Old Wang gets a plain no, not the noodle shop's 几杯", () => {
    // Reactions are keyed by slot name (wrong-<slot>) across the whole course.
    const counting = course!.scenes.find((s) => s.id === "street-numbers")!;
    for (const ex of counting.exchanges) {
      for (const slot of Object.keys(ex.slots)) expect(course!.reactions[`wrong-${slot}`], `${ex.id}: wrong-${slot}`).toBeUndefined();
    }
  });

  it("is set in 1980: no computers, and 电脑 counts toward no stage", () => {
    expect(course!.stageWords["1"]).not.toContain("w0123");
    expect(course!.words.w0123).toBeUndefined();
  });

  it("ships only the words the course uses", () => {
    const ids = Object.keys(course!.words);
    // The pack has over a thousand words; stage 1 content uses a small part of HSK 1.
    expect(ids.length).toBeLessThan(200);
    expect(ids).toContain("w0133");
    expect(course!.words.w0800).toBeUndefined(); // 对, HSK 4
  });

  it("resolves concepts, glosses and bonus words", () => {
    expect(course!.concepts.tea.map((id) => course!.words[id].w)).toEqual(["茶"]);
    expect(course!.words.x0001).toMatchObject({ w: "杯", bonus: true, gloss: "cup; glass (measure word for drinks)" });
    expect(course!.words.w0133.gloss).toBe("tea; tea plant");
  });
});

describe("build-course (broken content)", () => {
  it("with art off, ships no art at all, since nothing checked it", () => {
    const { errors, artDir } = buildChanged((dir) => {
      const f = join(dir, "courses/zh-china.json");
      const c = JSON.parse(readFileSync(f, "utf8"));
      c.checks.art = false;
      writeFileSync(f, JSON.stringify(c));
      writeFileSync(join(dir, "settings/china-city/art/npcs/wang.svg"), `<svg viewBox="0 0 400 900"><a href="javascript:x()"/></svg>`);
    });
    expect(errors).toEqual([]);
    expect(artDir).toBeUndefined();
  });

  it("fails when a scene's newWords override isn't a positive integer", () => {
    const f = join("settings/china-city/scenes/street-hello.json");
    const { errors } = buildChanged((dir) => {
      const p = join(dir, f);
      const sk = JSON.parse(readFileSync(p, "utf8"));
      sk.newWords = 0;
      writeFileSync(p, JSON.stringify(sk));
    });
    expect(errors.some((e) => e.includes('street-hello: "newWords" must be a positive integer'))).toBe(true);
  });

  it("with art on, fails on a missing drawing", () => {
    const { errors } = buildChanged((dir) => unlinkSync(join(dir, "settings/china-city/art/npcs/wang.svg")));
    expect(errors).toContain("settings/china-city/art/npcs/wang.svg: missing");
  });

  it(
    "with audio on, fails on a missing clip file and passes when all exist",
    () => {
      const { clips } = buildCourse(CONTENT, "zh-china");
      expect(clips.length).toBeGreaterThan(500);
      const make = (skip: number) =>
        buildChanged((dir) => {
          unlinkSync(join(dir, "audio")); // the link to the real clips, never the clips themselves
          mkdirSync(join(dir, "audio", "zh"), { recursive: true });
          clips.forEach((c, i) => i !== skip && writeFileSync(join(dir, "audio", "zh", `${c.id}.mp3`), ""));
          const cfgPath = join(dir, "courses", "zh-china.json");
          const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
          writeFileSync(cfgPath, JSON.stringify({ ...cfg, checks: { ...cfg.checks, audio: true } }));
        });
      expect(make(-1).errors).toEqual([]);
      expect(make(0).errors).toEqual([`audio: no file for clip ${clips[0].id}`]);
    },
    20_000,
  );

  it("reports voice-map problems", () => {
    const { errors } = buildChanged((dir) => {
      const p = join(dir, "languages", "zh", "voices.json");
      const v = JSON.parse(readFileSync(p, "utf8"));
      delete v.npcs.cook;
      writeFileSync(p, JSON.stringify(v));
    });
    expect(errors).toContain('voices: npc "cook" has no voice');
  });

  it("with audio on, needs voices.json", () => {
    const { errors } = buildChanged((dir) => {
      unlinkSync(join(dir, "languages", "zh", "voices.json"));
      const cfgPath = join(dir, "courses", "zh-china.json");
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
      writeFileSync(cfgPath, JSON.stringify({ ...cfg, checks: { ...cfg.checks, audio: true } }));
    });
    expect(errors).toContain("voices.json: missing (checks.audio is on)");
  });

  it("reports characters that are not in the word list", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, INTRO), "greet = 你好！\ngreet-reply = 喵。\njob = 工作，好吗？\njob-reply = 好。\n"));
    expect(bad.errors).toContain('noodle-intro/greet: "喵。" has characters outside the word list: 喵');
  });

  it("reports a line using a word the setting leaves out", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "settings/china-city/leave-out.json"), '["w0123", "w0124"]'));
    expect(bad.errors).toContain('tea-tv/on: "开电视！" uses 电视, which settings/china-city/leave-out.json leaves out');
  });

  it("reports a missing reply, a missing lines file and an unknown group", () => {
    const bad = buildChanged((d) => {
      writeFileSync(join(d, INTRO), "greet = 你好！\ngreet-reply = 你好！\njob = 工作，好吗？\n");
      unlinkSync(join(d, "languages/zh/lines/noodle-shift.ftl"));
    });
    expect(bad.errors).toContain('noodle-intro/job: missing message "job-reply"');
    expect(bad.errors.some((e) => e.startsWith("noodle-shift: no zh lines"))).toBe(true);

    const groups = buildChanged((d) => writeFileSync(join(d, "settings/china-city/groups.json"), '{ "groups": {} }'));
    expect(groups.errors.some((e) => /^noodle-shift\/\w+: unknown group/.test(e))).toBe(true);
  });

  it("reports a line with no meaning, and a scene with no meanings file", () => {
    const bad = buildChanged((d) => {
      writeFileSync(join(d, "learner/en/lines-zh/noodle-intro.ftl"), "greet = Hello!\ngreet-reply = Hello!\njob-reply = OK.\n");
      unlinkSync(join(d, "learner/en/lines-zh/noodle-shift.ftl"));
    });
    expect(bad.errors).toContain('noodle-intro/job (en meaning): missing message "job"');
    expect(bad.errors.some((e) => e.startsWith("noodle-shift: no en meanings"))).toBe(true);
  });

  it("reports narration that can't be formatted with the action's parameters", () => {
    const bad = buildChanged((d) => {
      const f = join(d, "learner/en/narration-china-city.ftl");
      writeFileSync(f, readFileSync(f, "utf8").replace("action-fetch = You bring { $item }.", "action-fetch = You bring { $itme }."));
    });
    expect(bad.errors.some((e) => e.startsWith('narration "action-fetch"'))).toBe(true);
  });

  it("reports a cost that isn't a number or a slot of numbers", () => {
    const bad = buildChanged((d) => {
      const f = join(d, "settings/china-city/scenes/warehouse-shift.json");
      const sk = JSON.parse(readFileSync(f, "utf8"));
      sk.exchanges[0].cost = "$item";
      sk.exchanges[1].cost = "$nope";
      writeFileSync(f, JSON.stringify(sk));
    });
    expect(bad.errors).toContain('warehouse-shift/carry: cost "$item" must be a number or a slot whose values are all numbers');
    expect(bad.errors).toContain('warehouse-shift/pick: cost "$nope" must be a number or a slot whose values are all numbers');
    const odd = buildChanged((d) => {
      const f = join(d, "settings/china-city/scenes/warehouse-shift.json");
      const sk = JSON.parse(readFileSync(f, "utf8"));
      sk.exchanges[0].cost = true;
      writeFileSync(f, JSON.stringify(sk));
    });
    expect(odd.errors).toContain("warehouse-shift/carry: cost true must be a number or a slot whose values are all numbers");
  });

  it("resolves a slot's cost into each variant", () => {
    const ok = buildChanged((d) => {
      const f = join(d, "settings/china-city/scenes/warehouse-shift.json");
      const sk = JSON.parse(readFileSync(f, "utf8"));
      sk.exchanges[0].cost = "$amount";
      sk.exchanges[1].cost = 2;
      writeFileSync(f, JSON.stringify(sk));
    });
    const shift = ok.course!.scenes.find((s) => s.id === "warehouse-shift")!;
    expect(shift.exchanges[0].variants["amount=seven|item=chair"].cost).toBe(7);
    expect(shift.exchanges[1].variants["item=chair|size=big"].cost).toBe(2);
  });

  it("reports a syntax error in a lines file once, not once per slot combination", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "languages/zh/lines/noodle-shift.ftl"), "order = {\n"));
    expect(bad.errors.filter((e) => e.includes("lines/noodle-shift.ftl"))).toHaveLength(1);
  });

  it("stops with an error, not a crash, when a file everything depends on is broken", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "languages/zh/terms.ftl"), "-tea = {\n"));
    expect(bad.course).toBeUndefined();
    expect(bad.errors[0]).toMatch(/^terms.ftl: terms.ftl: Fluent syntax error/);
  });
});

describe("courses and the catalog", () => {
  it("copies the setting's art next to the course", () => {
    const out = mkdtempSync(join(tmpdir(), "st-out-"));
    temps.push(out);
    const built = buildAll(CONTENT, "zh-china");
    writeCourses(out, built.builds, built.catalog, "zh-china");
    expect(existsSync(join(out, "zh-china/art/art.json"))).toBe(true);
    expect(existsSync(join(out, "zh-china/art/places/street.svg"))).toBe(true);
    expect(existsSync(join(out, "zh-china/art/npcs/wang.svg"))).toBe(true);
  });

  it("builds the course for its reading language with its profile and old ids", () => {
    const { course } = buildCourse(CONTENT, "zh-china");
    expect(course!.id).toBe("zh-china");
    expect(course!.learner).toBe("en");
    expect(course!.language).toEqual({ code: "zh", locale: "zh", tts: "zh-CN", spaced: false });
    expect(course!.aliases).toEqual(["zh-china-en"]);
    expect(Object.values(course!.words).find((w) => w.w === "你")!.readings).toEqual(["nǐ"]);
  });

  it("lists every course and its reading languages by name", () => {
    const { catalog, errors } = buildAll(CONTENT);
    expect(errors).toEqual([]);
    expect(catalog).toEqual([
      { id: "ja-japan", language: "ja", setting: "japan-city", learners: ["en"], learnerNames: { en: "English" } },
      { id: "zh-china", language: "zh", setting: "china-city", learners: ["en"], learnerNames: { en: "English" } },
    ]);
  });

  it("builds one file per reading language and names the course and reading language in errors", () => {
    const dir = copyContent((d) => {
      cpSync(join(d, "learner/en"), join(d, "learner/fr"), { recursive: true });
      const cfgPath = join(d, "courses/zh-china.json");
      writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, "utf8")), learners: ["en", "fr"] }));
      const ui = join(d, "learner/fr/ui.ftl");
      writeFileSync(ui, readFileSync(ui, "utf8").replace(/^learner-name = .*$/m, ""));
    });
    const { builds, errors } = buildAll(dir, "zh-china");
    expect(builds.map((b) => [b.course, b.learner])).toEqual([["zh-china", "en"], ["zh-china", "fr"]]);
    expect(builds[1].result.course!.learner).toBe("fr");
    expect(errors).toEqual(['zh-china/fr: learner/fr/ui.ftl: missing "learner-name"']);
  });

  it("fails a reading language that can't name the language", () => {
    const { errors } = buildChanged((d) => {
      const p = join(d, "learner/en/ui.ftl");
      writeFileSync(p, readFileSync(p, "utf8").replace(/^language-zh = .*$/m, ""));
    });
    expect(errors).toContain('learner/en/ui.ftl: missing "language-zh"');
  });

  it("fails a config without reading languages instead of cataloguing it", () => {
    const dir = copyContent((d) => {
      const p = join(d, "courses/zh-china.json");
      const { learners: _, ...cfg } = JSON.parse(readFileSync(p, "utf8"));
      writeFileSync(p, JSON.stringify({ ...cfg, learner: "en" }));
    });
    const message = 'courses/zh-china.json: learners must list at least one reading language';
    expect(buildCourse(dir, "zh-china").errors).toEqual([message]);
    const { catalog, errors } = buildAll(dir);
    expect(errors).toEqual([`zh-china: ${message}`]);
    expect(catalog.map((e) => e.id)).not.toContain("zh-china");
  });

  it("needs each reading language to name the language of every course in the catalog", () => {
    const entry = (id: string, language: string) => ({ id, language, setting: "s", learners: ["en"], learnerNames: { en: "English" } });
    const texts = [{ course: "zh-china", learner: "en", ftl: "learner-name = English\nlanguage-zh = Chinese\n" }];
    expect(languageNameProblems([entry("zh-china", "zh")], texts)).toEqual([]);
    expect(languageNameProblems([entry("zh-china", "zh"), entry("ja-tokyo", "ja")], texts)).toEqual([
      'zh-china/en: learner/en/ui.ftl: missing "language-ja" (ja-tokyo is in the catalog)',
    ]);
  });

  it("a one-course build replaces that course's files and keeps the others", () => {
    const out = mkdtempSync(join(tmpdir(), "st-dist-"));
    mkdirSync(join(out, "zh-china"), { recursive: true });
    mkdirSync(join(out, "other"), { recursive: true });
    writeFileSync(join(out, "zh-china", "fr.json"), "{}"); // a reading language since removed
    writeFileSync(join(out, "other", "en.json"), "{}");
    writeFileSync(join(out, "index.json"), JSON.stringify([{ id: "other", language: "xx", setting: "s", learners: ["en"], learnerNames: {} }]));
    const { catalog, builds } = buildAll(CONTENT, "zh-china");
    writeCourses(out, builds, catalog, "zh-china");
    expect(existsSync(join(out, "zh-china", "fr.json"))).toBe(false);
    expect(existsSync(join(out, "zh-china", "en.json"))).toBe(true);
    expect(existsSync(join(out, "other", "en.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8")).map((e: { id: string }) => e.id)).toEqual(["other", "zh-china"]);
    rmSync(out, { recursive: true, force: true });
  });

  it("refuses a right-to-left language", () => {
    const { course, errors } = buildChanged((d) => {
      const p = join(d, "languages/zh/pack.json");
      writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, "utf8")), direction: "rtl" }));
    });
    expect(course).toBeUndefined();
    expect(errors).toEqual(['language "zh" is written right to left; no front end can show that yet']);
  });

  it("refuses a reading language the course doesn't list", () => {
    expect(buildCourse(CONTENT, "zh-china", "fr").errors).toEqual(['courses/zh-china.json: "fr" is not in learners']);
  });

  it("refuses a config whose id isn't its file name", () => {
    const { errors } = buildChanged((d) => {
      const p = join(d, "courses/zh-china.json");
      writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, "utf8")), id: "other" }));
    });
    expect(errors).toEqual(['courses/zh-china.json: id "other" must match the file name']);
  });

  it("prefers a word's own readings to its pack pronunciation", () => {
    const { course } = buildChanged((d) => {
      const p = join(d, "languages/zh/words.json");
      const words = JSON.parse(readFileSync(p, "utf8")) as { w: string; readings?: string[] }[];
      words.find((w) => w.w === "你")!.readings = ["nǐ", "ni"];
      writeFileSync(p, JSON.stringify(words));
    });
    expect(Object.values(course!.words).find((w) => w.w === "你")!.readings).toEqual(["nǐ", "ni"]);
  });
});

describe("word forms", () => {
  it("copies a word's forms onto the built word", () => {
    const { course, errors } = buildChanged((dir) => {
      const path = join(dir, "languages", "zh", "words.json");
      const words = JSON.parse(readFileSync(path, "utf8")) as { w: string; forms?: Record<string, string[]> }[];
      words.find((w) => w.w === "谢谢")!.forms = { "谢谢你": ["xièxie nǐ"] };
      writeFileSync(path, JSON.stringify(words));
    });
    expect(errors).toEqual([]);
    expect(Object.values(course!.words).find((w) => w.w === "谢谢")!.forms).toEqual({ "谢谢你": ["xièxie nǐ"] });
  });
});
