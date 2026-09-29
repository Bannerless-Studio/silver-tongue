import { describe, expect, it } from "vitest";
import { createCore, mulberry32, newGame, type Course } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { CourseExtra } from "@silver-tongue/view";
import { firstSentence, openingStep, type OpeningStage } from "../src/opening";
import { createQuiet } from "../src/quiet";

const T0 = 1_000_000;
function setup(change: (c: Course) => void) {
  const course = fixtureWithText();
  change(course);
  const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
  let clock = T0;
  return { course, core, q: createQuiet({ course, core, now: () => (clock += 1000) }) };
}
const named = (c: Course) => void (c.needsName = true);
const book = (c: Course) => void ((c as unknown as CourseExtra).language.book = true);
const texts = (q: ReturnType<typeof setup>["q"]) => q.view().backlog.map((b) => b.text ?? b.line?.text);
const STORY = ["You arrive with ¥20 and no words.", "An old man on a bench is watching you with open curiosity."];

describe("opening of a book course", () => {
  it("a new game to be named keeps the story out of the transcript and offers it as the opening", () => {
    const { q } = setup((c) => (named(c), book(c)));
    expect(q.view().opening).toEqual(STORY);
    expect(q.view().backlog).toEqual([]);
    expect(q.view().phase.kind).toBe("name");
  });

  it("once named, the opening is gone and the transcript starts at the place, the story not repeated", () => {
    const { q } = setup((c) => (named(c), book(c)));
    expect(q.setName("Ana")).toBe(true);
    expect(q.view().opening).toBeUndefined();
    expect(q.view().phase.kind).toBe("explore");
    expect(texts(q)).toEqual(["The street."]);
    q.choose(0);
    q.choose(0);
    expect(texts(q)).not.toContain(STORY[0]);
  });

  it("a rejected name keeps the opening's name screen", () => {
    const { q } = setup((c) => (named(c), book(c)));
    expect(q.setName("")).toBe(false);
    expect(q.view().opening).toEqual(STORY);
  });

  it("a course without the Book is as before: the story in the transcript, the old name prompt, no opening", () => {
    const { q } = setup(named);
    expect(q.view().opening).toBeUndefined();
    expect(texts(q)).toEqual(STORY);
    expect(q.view().phase.kind).toBe("name");
    q.setName("Ana");
    expect(texts(q)).toEqual(STORY);
  });

  it("a book course that needs no name, or a named game, never opens on the crawl", () => {
    expect(setup(book).q.view().opening).toBeUndefined();
    const { q } = setup((c) => (named(c), book(c)));
    q.setName("Ana");
    const again = createQuiet({ course: q.course, core: q.core, now: () => T0 });
    expect(again.view().opening).toBeUndefined();
  });
});

describe("opening gate", () => {
  it("Enter and taps do nothing while the crawl moves; once it settles the next press opens the name screen", () => {
    let s: OpeningStage = "crawl";
    s = openingStep(s, "next");
    expect(s).toBe("crawl");
    s = openingStep(s, "settled");
    expect(s).toBe("ready");
    s = openingStep(s, "settled");
    expect(s).toBe("ready");
    s = openingStep(s, "next");
    expect(s).toBe("name");
    expect(openingStep(s, "next")).toBe("name");
    expect(openingStep(s, "settled")).toBe("name");
  });

  it("splits a paragraph after its first sentence", () => {
    expect(firstSentence("Someone is knocking. The textbook opens with [n].")).toEqual(["Someone is knocking.", " The textbook opens with [n]."]);
    expect(firstSentence("The rent, ₩50,000, falls due. Food costs.")).toEqual(["The rent, ₩50,000, falls due.", " Food costs."]);
    expect(firstSentence("On the desk: bills")).toEqual(["On the desk: bills", ""]);
    expect(firstSentence("You have ¥20.")).toEqual(["You have ¥20.", ""]);
  });
});
