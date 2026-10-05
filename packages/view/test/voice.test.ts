import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type GameEvent } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { extra } from "../src/course-extra";
import { makeText } from "../src/text";
import { emptyVoice, pickVoice, voiceDay, voiceDesk, voiceEvents, voiceHint, voiceOn, npcShort, voiceSeed, voiceGloss, voiceIntent, VOICE_POOLS, type VoiceMemory } from "../src/voice";

const ftl = readFileSync(new URL("../../../content/learner/en/voice-ko.ftl", import.meta.url), "utf8");
function setup() {
  const course = fixtureWithText();
  course.language.code = "ko";
  extra(course).language.book = true;
  extra(course).language.voice = true;
  course.learnerFtl += `\n${ftl}`;
  const t = makeText(course.learnerFtl, "en");
  const core = createCore(course, newGame(course), { now: () => 1000, rng: mulberry32(1) });
  const scene = course.scenes[0];
  core.send({ type: "goTo", place: scene.place });
  core.send({ type: "startScene", scene: scene.id });
  return { course, core, t };
}

describe("the inner voice", () => {
  it("classifies the first miss, second miss and stall without giving the reply", () => {
    const { course, core, t } = setup();
    expect(core.state.run).toBeTruthy();
    let before = structuredClone(core.state);
    const wrongChoice = () => core.state.run!.options.findIndex((key) => key !== comboKey(core.state.run!.combo));
    let events = core.send({ type: "reply", choice: wrongChoice() });
    expect(voiceEvents(course, before, core.state, events, t, 1000).map((c) => c.trigger)).toContain("first-miss");
    before = structuredClone(core.state);
    events = core.send({ type: "reply", choice: wrongChoice() });
    expect(voiceEvents(course, before, core.state, events, t, 1000).map((c) => c.trigger)).toContain("second-miss");
    const hint = voiceHint(course, core.state, t, 1000, "stall")!;
    expect(hint.trigger).toBe("stall");
    const run = core.state.run!;
    const reply = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].variants[comboKey(run.combo)].reply.text;
    const line = pickVoice(emptyVoice(), hint, t).line;
    expect(line).toBeTruthy();
    for (const word of hint.avoid ?? []) expect(line).not.toContain(word);
    expect(line).not.toContain(reply);
  });

  it("keeps every thought unique within each of two days and falls silent when a pool is exhausted", () => {
    const { t } = setup();
    let memory: VoiceMemory = emptyVoice(19);
    const vars = { npc: "Grandpa Park", asked: "He asks if I know Korean.", word: "알아요", gloss: "know", wordMeaning: " means know", shape: "I need to say no.", memory: "One reply will do.", reflection: "I heard him.", situation: "The wallet is thin.", rule: "Initial ㅇ is silent; the vowel starts the sound.", paper: "A stranger's ID.", day: 1, wallet: 20000, currency: "₩", known: 3, hunger: 0 };
    for (const day of [1, 2]) {
      const seen = new Set<string>();
      for (let i = 0; i < 7; i++) for (const trigger of VOICE_POOLS) {
        const p = pickVoice(memory, { day, trigger, vars: { ...vars, day, wallet: 20000 + i * 100 } }, t);
        memory = p.memory;
        if (!p.line) continue;
        expect(seen.has(p.line)).toBe(false);
        expect([...p.line].length).toBeLessThanOrEqual(140);
        seen.add(p.line);
      }
      expect(seen.size).toBe(VOICE_POOLS.length * 4);
      expect(new Set(memory.used).size).toBe(VOICE_POOLS.length * 4);
    }
  });

  it("substitutes state through Fluent, is seeded, and skips oversized variants without losing valid candidates", () => {
    const { course, core, t } = setup();
    const cue = voiceDay(course, { ...core.state, day: 4, wallet: 12345 }, t, 1000, "night");
    const a = pickVoice(emptyVoice(9), cue, t);
    expect(a).toEqual(pickVoice(emptyVoice(9), cue, t));
    expect(a.line).not.toMatch(/\{.*\$|voice-/);
    const huge = { ...cue, vars: { ...cue.vars, situation: "Long ".repeat(100) } };
    expect(pickVoice(emptyVoice(), huge, t).line).toContain("Neither feels like a fortune.");
    const oversized = makeText("voice-stall-1 = " + "x".repeat(141), "en");
    expect(pickVoice(emptyVoice(), { trigger: "stall", day: 1, vars: {} }, oversized).line).toBeUndefined();
  });

  it("derives scene reflection and separate night/day cues from events", () => {
    const { course, core, t } = setup();
    const before = { ...core.state, day: 1 };
    const after = { ...core.state, day: 2 };
    const events: GameEvent[] = [{ type: "sceneEnded", scene: course.scenes[0].id, earned: 5 }, { type: "dayEnded", day: 1, rough: false }];
    const cues = voiceEvents(course, before, after, events, t, 1000);
    expect(cues.map((c) => c.trigger)).toEqual(["scene-end", "night", "day-start"]);
    expect(cues.map((c) => c.day)).toEqual([1, 1, 2]);
    expect(cues[0].vars.reflection).toContain("first earnings");
  });

  it("has desk wrong-twice and paper-done cues, with completion only once", () => {
    const { course, core, t } = setup();
    const wrong = voiceDesk(course, core.state, t, 1000, "desk-wrong", "Initial ㅇ is silent; the vowel starts the sound.");
    expect(pickVoice(emptyVoice(), wrong, t).line).toContain("Initial ㅇ is silent; the vowel starts the sound.");
    const done = voiceDesk(course, core.state, t, 1000, "paper-done", "An ID, not mine.");
    const picked = pickVoice(emptyVoice(), done, t);
    expect(pickVoice(picked.memory, done, t).line).toBeUndefined();
  });

  it("stays absent on zh/ja and leaves onboarding new words to the existing row", () => {
    const { course, core, t } = setup();
    const before = newGame(course);
    const w = Object.keys(course.words)[0];
    const events: GameEvent[] = [{ type: "wordStateChanged", word: w, from: "unseen", to: "met" }];
    expect(voiceEvents(course, before, core.state, events, t, 1000)).toEqual([]);
    for (const code of ["zh", "ja"]) {
      course.language.code = code;
      delete extra(course).language.voice;
      expect(voiceOn(course)).toBe(false);
      expect(voiceEvents(course, before, core.state, [{ type: "sceneEnded", scene: course.scenes[0].id, earned: 1 }], t, 1000)).toEqual([]);
    }
  });
});

it("nudges a newly heard word only after onboarding and only once over two days", () => {
  const { course, core, t } = setup();
  const word = "hungry-test";
  course.words[word] = { ...Object.values(course.words)[0], id: word, w: "배고파요", gloss: "hungry" };
  const line = { text: "배고파요.", tokens: [{ word, start: 0, end: 4 }] };
  const before = structuredClone(core.state);
  const rec = { right: 0, wrong: 0, streak: 0, helps: 0, lapsed: false, firstSeen: 1000, lastSeen: 1000 };
  before.words = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`heard-${i}`, { ...rec }]));
  const events: GameEvent[] = [{ type: "lineSpoken", npc: course.scenes[0].npc, line }, { type: "wordStateChanged", word, from: "unseen", to: "met" }];
  const cue = voiceEvents(course, before, core.state, events, t, 1000).find((c) => c.trigger === "new-word")!;
  expect(cue.vars.word).toBe(line.text.slice(line.tokens[0].start, line.tokens[0].end));
  const picked = pickVoice(emptyVoice(), cue, t);
  expect(picked.line).toBeTruthy();
  expect(pickVoice(JSON.parse(JSON.stringify(picked.memory)), { ...cue, day: 2 }, t).line).toBeUndefined();
});

it("never renders an unearned reply even if a content variant accidentally contains it", () => {
  const t = makeText("voice-stall-1 = Say 몰라요.\nvoice-stall-2 = A breath first.\n", "en");
  const picked = pickVoice(emptyVoice(), { trigger: "stall", day: 1, vars: {}, avoid: ["아니요", "몰라요"] }, t);
  expect(picked.line).toBe("A breath first.");
});

it("does not reset the pool for an older cue, and distinguishes the first morning", () => {
  const { course, core, t } = setup();
  const cue = voiceDay(course, core.state, t, 1000);
  expect(cue.pool).toBe("first-day");
  const first = pickVoice(emptyVoice(), { ...cue, day: 2 }, t);
  const older = pickVoice(first.memory, { ...cue, day: 1, once: undefined }, t);
  expect(older.memory.day).toBe(2);
  expect(older.memory.used).toContain(first.memory.used[0]);
  expect(first.line).not.toContain("again");
});
it("uses a word-free echo pool whenever a reply word occurs inside the carrying word", () => {
  const { course, core, t } = setup();
  const run = core.state.run!;
  const v = course.scenes[0].exchanges[run.exchange].variants[comboKey(run.combo)];
  v.npc = structuredClone(v.reply);
  const cue = voiceHint(course, core.state, t, 1000, "first-miss")!;
  expect(cue.pool).toBe("echo");
  const line = pickVoice(emptyVoice(), cue, t).line!;
  for (const word of cue.avoid ?? []) expect(line).not.toContain(word);
});

it("keeps descriptive NPC articles in the voice's own person and seeds by identity", () => {
  const { t } = setup();
  expect(npcShort("The landlady")).toBe("the landlady");
  expect(t("voice-memory-used", { npcShort: npcShort("The landlady") })).toBe("I've made myself understood to the landlady before.");
  expect(voiceSeed("Sam")).toBe(voiceSeed("Sam"));
  expect(voiceSeed("Sam")).not.toBe(voiceSeed("Alex"));
});

it("cleans voice gloss punctuation without altering dictionary or menu content", () => {
  expect(voiceGloss("why?; why!")).toBe("why");
  expect(voiceGloss("yes!")).toBe("yes");
  expect(voiceIntent("Give your name instead")).toBe("give my name instead");
});
it("keeps second-miss intent wording on echo exchanges", () => {
  const { course, core, t } = setup();
  const run = core.state.run!;
  const v = course.scenes[0].exchanges[run.exchange].variants[comboKey(run.combo)];
  v.npc = structuredClone(v.reply);
  const first = voiceHint(course, core.state, t, 1000, "first-miss")!;
  const second = voiceHint(course, core.state, t, 1000, "second-miss")!;
  expect(first.pool).toBe("echo");
  expect(second.pool).toBeUndefined();
  expect(pickVoice(emptyVoice(), second, t).line).toContain(String(second.vars.shape));
});
