import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame, type Course } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { deskReady, deskOn, placeName, type CourseExtra, type DeskPaper, type DeskProgress } from "@silver-tongue/view";
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

  it("reading every paper lets the desk go: the place, renamed by the ID card", () => {
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
    // the knock had its own screen: the transcript never says it again
    expect(texts(q)).toEqual(["Min-jun's Street."]);
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

  it("goes on after only idcard.name, retaining unfinished paper progress", () => {
    const { q, papers } = setup((c) => {
      withPapers(c);
      (c as CourseExtra).papers![0].required = ["name"];
      (c as CourseExtra).papers![1].required = [];
    });
    q.setName("Ana");
    q.setDeskAt("idcard", 3);
    q.readPaperLine("idcard", "name");
    expect(q.readPapers().has("idcard")).toBe(false);
    expect(q.readPapers().has("bill")).toBe(false);
    expect(deskReady((q.course as CourseExtra).papers!, q.readPapers())).toBe(true);
    q.leaveDesk();
    expect(q.view().desk).toBeUndefined();
    expect(q.deskAt("idcard")).toBe(3);
    expect(papers.ids).toEqual(["idcard.name"]);
  });

  it("a new game starts with the desk unread, whatever an old game read", () => {
    const { q, papers } = setup(withPapers, memory(["idcard", "bill"]));
    q.setName("Ana");
    expect(q.view().desk).toBeDefined();
    expect(papers.ids).toEqual([]);
  });

  it("keeps the syllables read and the letters met between visits; a new game resets both", () => {
    const withChart = (c: Course) => {
      withPapers(c);
      (c as unknown as CourseExtra).letters = { groups: [{ id: "vowels", letters: [{ ch: "ㅣ" }, { ch: "ㅏ" }] }] } as CourseExtra["letters"];
    };
    let saved: DeskProgress = { at: { idcard: 2 }, met: ["vowels:ㅣ"] };
    const store: PaperStore = { load: () => [], save: () => {}, loadProgress: () => saved, saveProgress: (p) => void (saved = p) };
    const { q } = setup(withChart, store as PaperStore & { ids: string[] });
    expect(q.setName("Ana")).toBe(true);
    // naming resets both, then the desk is up
    expect(saved).toEqual({ at: {}, met: [] });
    expect(q.deskAt("idcard")).toBe(0);
    expect(q.deskMet()?.size).toBe(0);
    q.setDeskAt("idcard", 1);
    q.meet(["vowels:ㅣ"]);
    q.meet(["vowels:ㅣ", "vowels:ㅏ"]);
    expect(saved).toEqual({ at: { idcard: 1 }, met: ["vowels:ㅣ", "vowels:ㅏ"] });
    expect([...q.deskMet()!]).toEqual(["vowels:ㅣ", "vowels:ㅏ"]);
    // a paper read counts all its syllables, and its letters are met
    q.readPaper("idcard");
    expect(q.deskAt("idcard")).toBe(3);
  });

  it("without papers or a chart the Book keeps its whole chart", () => {
    const { q } = setup(() => {});
    expect(q.deskMet()).toBeUndefined();
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

describe("the knock and the first lines", () => {
  const atDoor = (store: PaperStore = memory()) => {
    const course = fixtureWithText();
    withPapers(course);
    const state = newGame(course);
    state.player = "Ana";
    state.place = "noodle_shop"; // where someone is waiting to talk
    const core = createCore(course, state, { now: () => T0, rng: mulberry32(1) });
    let clock = T0;
    return createQuiet({ course, core, now: () => (clock += 1000), papers: store });
  };
  const opened = (store?: PaperStore) => {
    const q = atDoor(store);
    q.readPaper("idcard");
    q.readPaper("bill");
    q.leaveDesk();
    return q;
  };

  it("opening the door starts the conversation: no menu, no second 'someone is knocking'", () => {
    const q = opened();
    expect(q.view().scene).toBeDefined();
    expect(q.view().phase.kind).toBe("pick");
    expect(texts(q)).not.toContain("Someone is knocking.");
  });

  it("the look-up hint sits under the scene's first NPC line until a word is looked up, and never comes back", () => {
    let done = false;
    const store: PaperStore = { load: () => [], save: () => {}, loadLookupDone: () => done, saveLookupDone: () => void (done = true) };
    const q = opened(store);
    const first = q.view().backlog.find((b) => b.line && b.speaker && b.speaker !== "player");
    expect(first).toBeDefined();
    expect(q.view().lookupHint).toBe(first!.id);
    q.lookUp(first!.line!.tokens[0].word);
    expect(q.view().lookupHint).toBeUndefined();
    expect(done).toBe(true);
  });

  it("a scene that ends without a look-up also ends the hint", () => {
    let done = false;
    const store: PaperStore = { load: () => [], save: () => {}, loadLookupDone: () => done, saveLookupDone: () => void (done = true) };
    const q = opened(store);
    for (let i = 0; i < 40 && q.view().scene; i++) q.choose(q.view().phase.kind === "pick" ? (q.core.state.run!.options.indexOf(comboKey(q.core.state.run!.combo))) : 0);
    expect(q.view().scene).toBeUndefined();
    expect(done).toBe(true);
  });

  it("is onboarding until ten words are heard", () => {
    expect(opened().view().onboard).toBe(true);
  });
});
