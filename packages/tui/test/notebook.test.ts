import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type WordRecord } from "@silver-tongue/core";
import { makeText, notebookEntries } from "@silver-tongue/view";
import { notebookBody, notebookGroups, notebookHead, type NotebookView } from "../src/notebook";
import { innerWidth } from "../src/panel";
import { plain } from "../src/terminal";
import { lineWidth } from "../src/width";
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

  it("heads the page with the tabs and progress", () => {
    const head = notebookHead(notebookEntries(course, state, t, LATER), t, "words").map(plain);
    expect(head[0]).toMatch(/1\) Words +2\) Notes/);
    expect(head[1]).toBe("Stage 1: 1 of 12 words known · 3 heard");
  });

  it("lists places on the left and the chosen place's words, bars and labels on the right", () => {
    const s = text({ group: 1 });
    expect(s).toMatch(/▸ Noodle shop \(2\)/);
    expect(s).toMatch(/▸ 你 nǐ +███░░ known/);
    expect(s).toMatch(/ 茶 +█░░░░ shaky/);
    expect(s).toContain("you");
    expect(s).not.toContain("杯");
  });

  it("puts recent words first, then the places", () => {
    const groups = notebookGroups(notebookEntries(course, state, t, T0), t);
    expect(groups.map((g) => g.title)).toEqual(["Recent", "The street", "Noodle shop"]);
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
