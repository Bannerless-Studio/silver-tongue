import { describe, expect, it } from "vitest";
import { createCore, mulberry32, newGame, type Course } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { CourseExtra } from "@silver-tongue/view";
import { firstSentence, openingStep, opensOnStory, travelMs, type OpeningStage } from "../src/opening";
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
    expect(firstSentence("Voices pass under the window. You can't understand a word.")).toEqual(["Voices pass under the window.", " You can't understand a word."]);
    expect(firstSentence("The rent, ₩50,000, falls due. Food costs.")).toEqual(["The rent, ₩50,000, falls due.", " Food costs."]);
    expect(firstSentence("On the desk: bills")).toEqual(["On the desk: bills", ""]);
    expect(firstSentence("You have ¥20.")).toEqual(["You have ¥20.", ""]);
  });

  it("travel time scales with the distance to the bottom edge, 1.2 s to 1.8 s", () => {
    expect(travelMs(0, 800)).toBe(4000);
    expect(travelMs(400, 800)).toBe(5250);
    expect(travelMs(800, 800)).toBe(6500);
    expect(travelMs(2000, 800)).toBe(6500);
    expect(travelMs(-10, 800)).toBe(4000);
    expect(travelMs(100, 0)).toBe(6500);
  });

  it("only a book course with a name to ask and no save opens straight on the story", () => {
    const c = (change: (c: Course) => void) => setup(change).course;
    expect(opensOnStory(c((x) => (named(x), book(x))), false)).toBe(true);
    expect(opensOnStory(c((x) => (named(x), book(x))), true)).toBe(false);
    expect(opensOnStory(c(named), false)).toBe(false);
    expect(opensOnStory(c(book), false)).toBe(false);
  });
});
