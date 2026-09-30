import { describe, expect, it } from "vitest";
import { createCore, mulberry32, newGame, type Course } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { deskOn, placeName, type CourseExtra, type DeskPaper } from "@silver-tongue/view";
import { readFileSync } from "node:fs";
import { createQuiet, type PaperStore } from "../src/quiet";

const T0 = 1_000_000;
const PAPERS: DeskPaper[] = [
  { id: "idcard", kind: "card", names: "street", lines: [{ id: "name", text: "김민준", audio: ["c1"] }] },
  { id: "bill", kind: "bill", lines: [{ id: "amount", text: "50,000원", audio: ["c2"] }] },
];
const withPapers = (c: Course) => {
  const x = c as unknown as CourseExtra;
  x.needsName = true;
  x.language.book = true;
  x.papers = structuredClone(PAPERS);
  x.learnerFtl += "\ndesk-done = Someone is knocking.\nplace-street-known = Min-jun's Street\n";
};
function memory(start: string[] = []): PaperStore & { ids: string[] } {
  const s = { ids: start, load: () => s.ids, save: (ids: string[]) => void (s.ids = ids) };
  return s;
}
function setup(change: (c: Course) => void, papers = memory()) {
  const course = fixtureWithText();
  change(course);
  const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
  let clock = T0;
  return { course, core, papers, q: createQuiet({ course, core, now: () => (clock += 1000), papers }) };
}
const texts = (q: ReturnType<typeof setup>["q"]) => q.view().backlog.map((b) => b.text ?? b.line?.text);

describe("the desk", () => {
  it("comes after the name screen on a book course with papers, and holds the transcript back", () => {
    const { q } = setup(withPapers);
    expect(q.view().desk).toBeUndefined();
    expect(q.setName("Ana")).toBe(true);
    expect(q.view().desk?.map((p) => p.id)).toEqual(["idcard", "bill"]);
    expect(texts(q)).toEqual([]);
  });

  it("reading every paper lets the desk go: the place, renamed by the ID card, then the knock", () => {
    const { q, papers } = setup(withPapers);
    q.setName("Ana");
    q.readPaper("idcard");
    q.leaveDesk(); // not yet: the bill is unread
    expect(q.view().desk).toBeDefined();
    expect(q.placeLabel()).toBe("Min-jun's Street");
    q.readPaper("bill");
    expect(papers.ids).toEqual(["idcard", "bill"]);
    q.leaveDesk();
    expect(q.view().desk).toBeUndefined();
    expect(texts(q)).toEqual(["Min-jun's Street.", "Someone is knocking."]);
  });

  it("a reload keeps the papers read; all read, the desk never comes back", () => {
    const course = fixtureWithText();
    withPapers(course);
    const state = newGame(course);
    state.player = "Ana";
    const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
    const q = createQuiet({ course, core, now: () => T0, papers: memory(["idcard"]) });
    expect(q.view().desk).toBeDefined();
    expect(q.readPapers().has("idcard")).toBe(true);
    const q2 = createQuiet({ course, core: createCore(course, state, { now: () => T0, rng: mulberry32(1) }), now: () => T0, papers: memory(["idcard", "bill"]) });
    expect(q2.view().desk).toBeUndefined();
  });

  it("a new game starts with the desk unread, whatever an old game read", () => {
    const { q, papers } = setup(withPapers, memory(["idcard", "bill"]));
    q.setName("Ana");
    expect(q.view().desk).toBeDefined();
    expect(papers.ids).toEqual([]);
  });

  it("a game with a scene done never shows the desk", () => {
    const course = fixtureWithText();
    withPapers(course);
    const state = { ...newGame(course), player: "Ana", scenesDone: { [course.scenes[0].id]: 1 } };
    expect(deskOn(course, state, new Set())).toBe(false);
  });

  it("zh and ja courses have no desk and keep their place names", () => {
    for (const id of ["zh-china", "ja-japan"]) {
      const course = JSON.parse(readFileSync(new URL(`../../../dist/courses/${id}/en.json`, import.meta.url), "utf8")) as Course;
      expect((course as CourseExtra).papers).toBeUndefined();
      const state = newGame(course);
      expect(deskOn(course, state, new Set(["idcard"]))).toBe(false);
      const t = (k: string) => k;
      expect(placeName(course, state, new Set(["idcard"]), t as never)).toBe(`place-${state.place}`);
    }
  });

  it("a course without the Book has no desk even with papers", () => {
    const { q } = setup((c) => (withPapers(c), ((c as unknown as CourseExtra).language.book = false)));
    q.setName("Ana");
    expect(q.view().desk).toBeUndefined();
    expect(q.placeLabel()).toBe("The street");
  });
});
