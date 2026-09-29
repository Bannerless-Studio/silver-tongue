import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type Course, type WordRecord } from "@silver-tongue/core";
import { extra, lettersView, makeText, notebookEntries, papers, type CourseExtra } from "@silver-tongue/view";
import { moveLetter, notebookBody, notebookGroups, notebookHead, notebookTabs, type BookExtras, type NotebookView } from "../src/notebook";
import { innerWidth } from "../src/panel";
import { plain } from "../src/terminal";
import { lineWidth, strWidth } from "../src/width";
import { fixtureWithText, spacedWithText } from "./fake-terminal";

const T0 = 1_000_000;
// A day and a half on: nothing heard at T0 is recent, and a streak-3 word (2 days) is still known.
const LATER = T0 + 1.5 * 86_400_000;
const rec = (patch: Partial<WordRecord>): WordRecord => ({
  right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0, ...patch,
});
const view = (patch: Partial<NotebookView> = {}): NotebookView => ({ tab: "words", group: 0, word: 0, open: false, top: 0, ...patch });

describe("notebook", () => {
  const course = fixtureWithText();
  course.notes = [{ id: "hao", trigger: { word: "w_hao" } }];
  const t = makeText(course.learnerFtl, "en");
  const state = newGame(course);
  state.words = {
    w_ni: rec({ streak: 3, right: 3, first: { line: "你好！", place: "noodle_shop" } }),
    w_cha: rec({ lapsed: true, first: { line: "茶。", place: "noodle_shop" } }),
    x_bei: rec({ first: { line: "三杯茶。", place: "street" } }),
  };
  state.notes.read = ["hao"];
  const body = (v: Partial<NotebookView>, cols = 80, now = LATER, height = 10) =>
    notebookBody(notebookEntries(course, state, t, now), t, view(v), cols, height);
  const text = (v: Partial<NotebookView>, cols = 80, now = LATER) => body(v, cols, now).lines.map(plain).join("\n");

  it("wraps the empty Words and Notes messages to a phone's width", () => {
    const fresh = newGame(course);
    const nb = notebookEntries(course, fresh, t, LATER);
    for (const tab of ["words", "notes"] as const) {
      const lines = notebookBody(nb, t, view({ tab }), 40, 6).lines;
      for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(innerWidth(40));
      expect(lines.map(plain).join(" ").replace(/\s+/g, " ")).toContain(t(tab === "words" ? "notebook-empty" : "notebook-notes-empty"));
    }
  });

  it("heads the page with the tabs and progress", () => {
    const head = notebookHead(notebookEntries(course, state, t, LATER), t, "words").map(plain);
    expect(head[0]).toMatch(/1\) Words +2\) Phrases +3\) People +4\) Places +5\) Notes/);
    expect(head[1]).toBe("Stage 1: 1 of 12 words known");
  });

  it("lists places on the left and the chosen place's words, bars and labels on the right", () => {
    const s = text({ group: 1 });
    expect(s).toMatch(/▸ Noodle shop \(2\)/);
    expect(s).toMatch(/▸ 你 nǐ +███░░ safe/);
    expect(s).toMatch(/ 茶 +█░░░░ fading/);
    expect(s).toContain("you");
    expect(s).not.toContain("杯");
  });

  it("puts recent words first, then the places, and leaves Recent out when it would hold every word", () => {
    const older = { ...state, words: { ...state.words, w_ni: { ...state.words.w_ni, firstSeen: T0 - 2 * 86_400_000 } } };
    const groups = notebookGroups(notebookEntries(course, older, t, T0), t);
    expect(groups.map((g) => g.title)).toEqual(["★ Recent", "The street", "Noodle shop"]);
    expect(groups[0].items.map((w) => w.id)).not.toContain("w_ni");
    // Everything was heard today: Recent would only repeat the places.
    expect(notebookGroups(notebookEntries(course, state, t, T0), t).map((g) => g.title)).toEqual(["The street", "Noodle shop"]);
    expect(notebookGroups(notebookEntries(course, state, t, LATER), t).map((g) => g.title)).toEqual(["The street", "Noodle shop"]);
  });

  it("opens the chosen word to show the line it was first heard in, with the player's name", () => {
    const named = { ...state, player: "Jamil", words: { ...state.words, x_bei: rec({ first: { line: `是${PLAYER_MARK}。`, place: "street" } }) } };
    const nb = notebookEntries(course, named, t, LATER);
    expect(notebookBody(nb, t, view({ open: true }), 80, 10).lines.map(plain).join("\n")).toContain("是Jamil。");
    expect(notebookBody(nb, t, view(), 80, 10).lines.map(plain).join("\n")).not.toContain("是Jamil。");
  });

  it("scrolls the list so the chosen word shows", () => {
    const s = body({ group: 1, word: 1 }, 80, LATER, 2).lines.map(plain).join("\n");
    expect(s).toContain("茶");
  });

  it("is one column at phone width, the place named with arrows", () => {
    const lines = body({ group: 0 }, 40).lines;
    expect(plain(lines[0])).toMatch(/^ +The street \(1\) ▸/);
    for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(innerWidth(40));
  });

  it("clamps a group that no longer exists", () => {
    expect(text({ group: 9 })).toMatch(/▸ Noodle shop \(2\)/);
  });

  it("shows the notes read so far on the Notes tab, or says there are none", () => {
    expect(text({ tab: "notes" })).toMatch(/好 means good\nOn its own, 好 agrees\./);
    const none = newGame(course);
    const nb = notebookEntries(course, none, t, LATER);
    expect(notebookBody(nb, t, view({ tab: "notes" }), 80, 5).lines.map(plain).join("\n")).toContain("No notes yet.");
  });

  it("says so when nothing has been heard yet", () => {
    const nb = notebookEntries(course, newGame(course), t, LATER);
    expect(notebookBody(nb, t, view(), 80, 5).lines.map(plain).join("\n")).toContain("Nothing yet.");
  });

  it("is always exactly the height asked for, and within the frame", () => {
    for (const cols of [40, 64, 120])
      for (const v of [view(), view({ tab: "notes" }), view({ group: 1, open: true })]) {
        const { lines } = notebookBody(notebookEntries(course, state, t, T0), t, v, cols, 7);
        expect(lines.length).toBe(7);
        for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(innerWidth(cols));
      }
  });

  it("shows every reading of a word", () => {
    const spaced = spacedWithText();
    const s = newGame(spaced);
    s.words = { w_ni: rec({ first: { line: "mi bon!", place: "noodle_shop" } }) };
    const nb = notebookEntries(spaced, s, t, LATER);
    expect(notebookBody(nb, t, view(), 80, 5).lines.map(plain).join("\n")).toContain("mi mí mi");
  });
});

describe("the Book's Letters and Papers", () => {
  /** The fixture with a small letter chart, and its first exchange (你好！) pinned as a paper. */
  function bookCourse(): Course {
    const c = structuredClone(fixtureWithText()) as unknown as CourseExtra;
    c.letters = {
      groups: [
        { id: "consonants", letters: [{ ch: "ㄱ", reading: "g/k", audio: ["l1"] }, { ch: "ㄴ", reading: "n", audio: ["l2"] }, { ch: "ㄷ", reading: "d/t" }] },
        { id: "vowels", letters: [{ ch: "ㅏ", reading: "a" }, { ch: "ㅓ", reading: "eo" }] },
      ],
    };
    extra(c as unknown as Course).scenes[0].exchanges[0].pin = true;
    return c as unknown as Course;
  }
  const course = bookCourse();
  const t = makeText(course.learnerFtl, "en");
  const state = newGame(course);
  state.scenesDone = { intro: 1 };
  state.words = { w_ni: rec({ streak: 3, right: 3 }) };
  const ex: BookExtras = { course, letters: lettersView(course, t), papers: papers(course, state, t, LATER) };
  const nb = notebookEntries(course, state, t, LATER);
  const body = (v: Partial<NotebookView>, cols = 80, height = 12, extras: BookExtras = ex) => notebookBody(nb, t, view(v), cols, height, extras).lines.map(plain);

  it("puts Letters first only for a language with a letter chart", () => {
    expect(notebookTabs(false)).toEqual(["words", "phrases", "papers", "people", "places", "notes"]);
    expect(notebookHead(nb, t, "letters", notebookTabs(true)).map(plain)[0]).toMatch(/^1\) Letters +2\) Words +3\) Phrases +4\) Papers/);
  });

  it("draws the letters in a grid by group, each over how it sounds, the chosen one lit", () => {
    const lines = body({ tab: "letters", word: 1 });
    const s = lines.join("\n");
    expect(s).toContain("Consonants");
    expect(s).toContain("Vowels");
    const row = lines.findIndex((l) => l.includes("ㄱ"));
    expect(lines[row + 1]).toContain("g/k");
    // each reading starts under its letter
    for (const [ch, r] of [["ㄴ", "n"], ["ㄷ", "d/t"]]) expect(strWidth(lines[row + 1].slice(0, lines[row + 1].indexOf(r)))).toBe(strWidth(lines[row].slice(0, lines[row].indexOf(ch))));
    const styled = notebookBody(nb, t, view({ tab: "letters", word: 1 }), 80, 12, ex).lines.flat();
    expect(styled.find((sp) => sp.text.includes("ㄴ"))).toMatchObject({ inverse: true });
    expect(styled.find((sp) => sp.text.includes("ㄱ"))?.inverse).toBeUndefined();
  });

  it("moves the chosen letter along the chart, and up and down by rows", () => {
    // 80 columns fit the whole group on a row: down goes to the vowels, keeping the column where it can
    expect(moveLetter(ex.letters, 80, 0, "right")).toBe(1);
    expect(moveLetter(ex.letters, 80, 0, "left")).toBe(0);
    expect(moveLetter(ex.letters, 80, 2, "down")).toBe(4);
    expect(moveLetter(ex.letters, 80, 3, "up")).toBe(0);
    expect(moveLetter(ex.letters, 80, 4, "right")).toBe(4);
    // at 16 columns two letters fit on a row
    expect(moveLetter(ex.letters, 16, 0, "down")).toBe(2);
  });

  it("lists each paper with who handed it over, where, and how much of it is known", () => {
    const s = body({ tab: "papers" }).join("\n");
    expect(s).toMatch(/▸ Cook, at the Noodle shop +██░░ 1\/2/);
    expect(s).not.toContain("你好");
  });

  it("opens a paper: known words as they are, the rest as their reading (dim) or a blank, then the known words' glosses", () => {
    const lines = body({ tab: "papers", open: true });
    const line = lines.find((l) => l.includes("你"))!;
    expect(line).toMatch(/你hǎo！/);
    expect(lines.join("\n")).toMatch(/你 +you/);
    const styled = notebookBody(nb, t, view({ tab: "papers", open: true }), 80, 12, ex).lines.flat();
    expect(styled.find((sp) => sp.text === "hǎo")).toMatchObject({ dim: true });
    const noReading = structuredClone(course);
    delete noReading.words.w_hao.readings;
    const blank = papers(noReading, state, t, LATER);
    expect(body({ tab: "papers", open: true }, 80, 12, { ...ex, course: noReading, papers: blank }).join("\n")).toMatch(/你____！/);
  });

  it("says so when no paper is kept yet", () => {
    const s = body({ tab: "papers" }, 40, 6, { ...ex, papers: [] }).join(" ").replace(/\s+/g, " ");
    expect(s).toContain("Nothing yet. Notices and papers you are handed are kept here.");
  });
});

