import { fileURLToPath } from "node:url";
import { buildCourse } from "../../../tools/src/build-course";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCore, mulberry32, newGame, personalize, PLAYER_MARK, type Course, type GameEvent, type RenderedLine } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { bestMeaning, normalizeMeaning, scribeRules, freshOnReply, freshOnTheirLine, meaningMatches, scribeScenes, scribeAccepts, scribeReplyId, scribeCountKey, type CourseExtra } from "@silver-tongue/view";
import { emptyOpeningChoices, type OpeningChoices } from "../src/door-choices";
import { resolveScribeReply, openingStore, scribeOn, scribeRound, updateRound, writeCount } from "../src/scribe";

const realCourse = buildCourse(fileURLToPath(new URL("../../../content", import.meta.url)), "ko-seoul").course!;
const SCRIBE_SCENES = scribeScenes(realCourse);

/** A course with or without the desk (papers to read by romanising). */
const course = (desk: boolean) => {
  const c = fixtureWithText();
  (c as unknown as CourseExtra).language.book = true;
  (c as unknown as CourseExtra).labOpening = (realCourse as CourseExtra).labOpening;
  (c as unknown as CourseExtra).papers = desk ? [{ id: "card", kind: "card", lines: [{ id: "name", text: "x" }] }] : [];
  return c;
};

describe("scribeOn", () => {
  it("is on in the lab, on a course with the desk, in the first two scenes", () => {
    for (const scene of SCRIBE_SCENES) expect(scribeOn({ scene }, course(true), true)).toBe(true);
  });
  it("is off in later scenes and between scenes", () => {
    expect(scribeOn({ scene: "street-again" }, course(true), true)).toBe(false);
    expect(scribeOn({}, course(true), true)).toBe(false);
  });
  it("is off everywhere when the page is not the lab", () => {
    for (const scene of [...SCRIBE_SCENES, "street-again", undefined]) expect(scribeOn({ scene }, course(true), false)).toBe(false);
  });
  it("is off on a course without the desk (its script is not read by romanising)", () => {
    expect(scribeOn({ scene: "room-wake" }, course(false), true)).toBe(false);
  });
  it("defaults to the page's meta: off where there is no page (the main site's path)", () => {
    expect(scribeOn({ scene: "room-wake" }, course(true))).toBe(false);
  });
});

describe("rounds", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });
  afterEach(() => void delete (globalThis as { localStorage?: Storage }).localStorage);

  it("persists both friendship choices across recreated stores, isolated by saved game", () => {
    for (const friend of ["reply", "alt1"] as const) {
      const choices: OpeningChoices = { options: { "room-wake:friend": friend, "street-hello:hello": "silence" }, cardAt: 0, cardRead: friend === "reply" };
      openingStore(realCourse, "a").save(choices);
      expect(openingStore(realCourse, "a").load()).toEqual(choices);
      expect(openingStore(realCourse, "b").load()).toEqual(emptyOpeningChoices());
    }
    openingStore(realCourse, "a").save(emptyOpeningChoices());
    expect(openingStore(realCourse, "a").load()).toEqual(emptyOpeningChoices());
  });

  const quiet = () => ({}) as object; // a Quiet is only an owner key here
  it("count the exchanges a course has begun, once each, and keep that between visits", () => {
    const q = quiet();
    expect(scribeRound(q, "ko-seoul", 1).index).toBe(0);
    expect(scribeRound(q, "ko-seoul", 1).index).toBe(0);
    expect(scribeRound(q, "ko-seoul", 5).index).toBe(1);
    expect(store.get(scribeCountKey("ko-seoul"))).toBe("2");
    expect(scribeRound(quiet(), "ko-seoul", 9).index).toBe(2); // a new visit
    expect(scribeRound(q, "other", 1).index).toBe(0);
  });
  it("asks for the tied slips rather than saying the first, scoped to this exchange", () => {
    const slips = [{ meaning: "Goodbye.", intent: "Leave" }, { meaning: "Goodbye.", intent: "Stay" }, { meaning: "Hello." }];
    const match = resolveScribeReply("bye", slips);
    expect(match).toEqual({ kind: "choose", indices: [0, 1] });
    const q = quiet();
    if (match.kind === "choose") updateRound(q, "ko-seoul", 1, { ties: match.indices });
    expect(scribeRound(q, "ko-seoul", 1).ties.map((i) => slips[i].intent)).toEqual(["Leave", "Stay"]);
    expect(scribeRound(q, "ko-seoul", 2).ties).toEqual([]);
    expect(resolveScribeReply("hello", slips)).toEqual({ kind: "say", index: 2 });
  });

  it("change by patch and keep the rest", () => {
    const q = quiet();
    scribeRound(q, "ko-seoul", 1);
    updateRound(q, "ko-seoul", 1, { misses: 2 });
    updateRound(q, "ko-seoul", 1, { solved: true });
    expect(scribeRound(q, "ko-seoul", 1)).toMatchObject({ misses: 2, solved: true, help: 0, index: 0 });
  });
  it("belong to the game: a second Quiet for the same course starts with fresh rounds (beat ids restart at 1)", () => {
    const a = quiet();
    scribeRound(a, "ko-seoul", 1);
    updateRound(a, "ko-seoul", 1, { misses: 3, solved: true, help: 2 });
    const b = quiet();
    expect(scribeRound(b, "ko-seoul", 1)).toMatchObject({ misses: 0, solved: false, help: 0 });
    expect(scribeRound(a, "ko-seoul", 1)).toMatchObject({ misses: 3, solved: true });
  });
  it("restart the arc when the count is set (a lab jump)", () => {
    scribeRound(quiet(), "ko-seoul", 1);
    scribeRound(quiet(), "ko-seoul", 2);
    writeCount("ko-seoul", 0);
    expect(scribeRound(quiet(), "ko-seoul", 1).index).toBe(0);
    writeCount("ko-seoul", 4);
    expect(scribeRound(quiet(), "ko-seoul", 1).index).toBe(4);
  });
});

describe("the real scribe scenes (ko-seoul build)", () => {
  const built = buildCourse(fileURLToPath(new URL("../../../content", import.meta.url)), "ko-seoul").course!;
  const name = (s?: string) => s?.split(PLAYER_MARK).join("Alex") ?? "";
  const SCRIBE_ACCEPTS = scribeRules(built);
  const scenes = scribeScenes(built).map((id) => built.scenes.find((s) => s.id === id)!);

  it("have a meaning on every line the player reads or types", () => {
    for (const s of scenes) for (const ex of s.exchanges) for (const v of Object.values(ex.variants)) for (const l of [v.npc, v.reply, ...(v.alts ?? [])]) expect(name(l.meaning), `${s.id}/${ex.id}`).not.toBe("");
  });

  it("let the player type their way to the right reply: its own meaning picks it from the slips", () => {
    for (const s of scenes) {
      for (const ex of s.exchanges) {
        for (const [key, v] of Object.entries(ex.variants)) {
          // the slips as core offers them: the reply, its alts, and the replies of a sibling variant
          const sibling = Object.entries(ex.variants).filter(([k]) => k !== key).map(([, o]) => o.reply).slice(0, 2);
          const slips = [v.reply, ...(v.alts ?? []), ...sibling];
          const typed = name(v.reply.meaning);
          const at = bestMeaning(typed, slips.map((l) => ({ meaning: name(l.meaning), accepts: scribeAccepts(built, s.id, scribeReplyId(built, s.id, ex.id, personalize(l, "Alex"), "Alex"), "Alex") })));
          expect(slips[at]?.text, `${s.id}/${ex.id}[${key}] typing "${typed}"`).toBe(v.reply.text);
        }
      }
    }
  });

  it("sweeps EVERY scribe line: exact meanings, visible fragments, opposite negation, live keys", () => {
    const current = new Map<string, string>();
    for (const s of scenes) for (const ex of s.exchanges) for (const v of Object.values(ex.variants)) {
      const lines: [string, RenderedLine][] = [[ex.id, v.npc], [`${ex.id}-reply`, v.reply], ...(v.alts ?? []).map((l, i): [string, RenderedLine] => [`${ex.id}-alt${i + 1}`, l]), ...Object.entries(v.altOutcomes ?? {}).flatMap(([i, outcome]): [string, RenderedLine][] => outcome.reaction ? [[`${ex.id}-alt${i}-answer`, outcome.reaction]] : [])];
      for (const [id, l] of lines) {
        const key = `${s.id}:${id}`;
        const meaning = name(l.meaning);
        current.set(key, meaning);
        const fragments = scribeAccepts(built, s.id, id, "Alex");
        if (id !== ex.id && !id.endsWith("-answer")) expect(scribeReplyId(built, s.id, ex.id, personalize(l, "Alex"), "Alex"), key).toBe(id);
        expect(fragments.length, key).toBeGreaterThan(0);
        expect(meaningMatches(meaning, meaning, fragments), key).toBe(true);
        for (const fragment of fragments) {
          expect(meaningMatches(fragment, meaning, fragments), `${key}: ${fragment}`).toBe(true);
          const norm = normalizeMeaning(fragment);
          const hasNeg = /\b(no|not|never|nothing|none)\b/.test(norm);
          const flip = hasNeg ? norm.replace(/\b(no|not|never|nothing|none)\b/g, "").trim() || "yes" : `not ${fragment}`;
          expect(meaningMatches(flip, meaning, fragments), `${key}: flipped ${fragment}`).toBe(false);
        }
      }
    }
    expect([...current.keys()].sort()).toEqual(Object.keys(SCRIBE_ACCEPTS).sort());
    for (const [key, rule] of Object.entries(SCRIBE_ACCEPTS)) {
      expect(current.get(key), key).toBe(rule.meaning.replace("{ $player }", "Alex"));
    }
  });
});

describe("first-time glosses (real ko-seoul room-wake)", () => {
  const c = buildCourse(fileURLToPath(new URL("../../../content", import.meta.url)), "ko-seoul").course!;
  const play = () => {
    let clock = 0;
    const core = createCore(c, newGame(c), { now: () => clock, rng: mulberry32(1) });
    const send = (input: Parameters<typeof core.send>[0]) => ((clock += 1000), core.send(input));
    if (c.needsName) send({ type: "setName", name: "Alex" });
    const evs = send({ type: "startScene", scene: "room-wake" });
    return { core, send, evs };
  };
  const replyLines = (evs: GameEvent[]): RenderedLine[] => {
    const e = evs.find((x) => x.type === "replyOptions");
    return e && e.type === "replyOptions" && e.mode === "pick" ? e.options : [];
  };
  const ids = (l: RenderedLine) => l.tokens.map((t) => t.word);

  it("a first line and its replies are all new; every word of a met line is not", () => {
    const { core, evs } = play();
    const their = (evs.find((e) => e.type === "lineSpoken") as Extract<GameEvent, { type: "lineSpoken" }>).line;
    const opts = replyLines(evs);
    const fresh = freshOnTheirLine(their, core.state.words);
    expect(fresh.size).toBe(new Set(ids(their)).size); // heard just now: still new while the line is on stage
    for (const o of opts) expect([...freshOnReply(o, core.state.words)].sort(), o.text).toEqual([...new Set(ids(o))].filter((w) => !core.state.words[w]?.first).sort());
    expect(opts.some((o) => freshOnReply(o, core.state.words).size > 0)).toBe(true);
  });

  it("a word said in a reply is not new on the next exchange, nor on the same reply again", () => {
    const { core, send, evs } = play();
    const opts = replyLines(evs);
    const run = core.state.run!;
    const right = opts.findIndex((_: RenderedLine, i: number) => run.options[i] === run.keys![0]);
    const said = opts[right];
    expect(freshOnReply(said, core.state.words).size).toBeGreaterThan(0);
    const after = send({ type: "reply", choice: right });
    expect(freshOnReply(said, core.state.words).size).toBe(0);
    const next = after.find((e) => e.type === "lineSpoken") as Extract<GameEvent, { type: "lineSpoken" }> | undefined;
    if (next) for (const w of freshOnTheirLine(next.line, core.state.words)) expect(core.state.words[w]?.first?.line, w).toBe(next.line.text);
  });

  it("a repeat of a line already met is bare once a word was got right", () => {
    const { core } = play();
    const l: RenderedLine = { text: "x", tokens: [{ start: 0, end: 1, word: "w" }] };
    const words = { w: { first: { line: "x" }, right: 1 } };
    expect(freshOnTheirLine(l, words as never).size).toBe(0);
    expect(freshOnTheirLine(l, { w: { first: { line: "x" }, right: 0 } } as never).size).toBe(1);
    expect(freshOnTheirLine(l, {}).size).toBe(1);
    expect(core).toBeTruthy();
  });
});
