import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PLAYER_MARK, type RenderedLine } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { bestMeaning, meaningMatches, SCRIBE_SCENES, scribeAccepts, scribeCountKey, type CourseExtra } from "@silver-tongue/view";
import { scribeOn, scribeRound, updateRound, writeCount } from "../src/scribe";

/** A course with or without the desk (papers to read by romanising). */
const course = (desk: boolean) => {
  const c = fixtureWithText();
  (c as unknown as CourseExtra).language.book = true;
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
  const built = JSON.parse(readFileSync(new URL("../../../dist/courses/ko-seoul/en.json", import.meta.url), "utf8")) as { scenes: { id: string; exchanges: { id: string; variants: Record<string, { npc: RenderedLine; reply: RenderedLine; alts?: RenderedLine[] }> }[] }[] };
  const name = (s?: string) => s?.split(PLAYER_MARK).join("Alex") ?? "";
  const scenes = SCRIBE_SCENES.map((id) => built.scenes.find((s) => s.id === id)!);

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
          const at = bestMeaning(typed, slips.map((l) => ({ meaning: name(l.meaning), accepts: scribeAccepts(l.meaning ?? "") })));
          expect(slips[at]?.text, `${s.id}/${ex.id}[${key}] typing "${typed}"`).toBe(v.reply.text);
        }
      }
    }
  });

  it("accept their line's own meaning", () => {
    for (const s of scenes) for (const ex of s.exchanges) for (const v of Object.values(ex.variants)) {
      expect(meaningMatches(name(v.npc.meaning), name(v.npc.meaning), scribeAccepts(v.npc.meaning ?? ""))).toBe(true);
    }
  });
});
