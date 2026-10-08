import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { extra, stageGate, stageGateText, makeText } from "../src/index";

describe("stage gates", () => {
  // The fixture's shift, moved to stage 2: it needs the cook's trust and comes after the intro.
  const course = fixtureWithText();
  extra(course).language = { ...extra(course).language, book: true };
  course.scenes.find((s) => s.id === "shift")!.stage = 2;
  const trusted = { ...newGame(course), trust: { cook: 1 }, scenesDone: { intro: 1 } };

  it("the first scene of a new stage opens a gate naming who trusts you", () => {
    expect(stageGate(course, trusted, ["shift"], ["intro", "shift"])).toEqual({ stage: 2, npcs: ["cook"], scene: "shift" });
  });

  it("no gate for a scene of the first stage, nor once the stage was open or done", () => {
    expect(stageGate(course, trusted, ["intro"], ["intro"])).toBeUndefined();
    expect(stageGate(course, trusted, [], ["intro", "shift"])).toBeUndefined();
    expect(stageGate(course, { ...trusted, scenesDone: { intro: 1, shift: 1 } }, ["shift"], ["shift"])).toBeUndefined();
  });

  it("names only people who trust you at all, and no gate without the Book", () => {
    expect(stageGate(course, { ...trusted, trust: {} }, ["shift"], ["shift"])!.npcs).toEqual([]);
    const plain = structuredClone(course);
    delete extra(plain).language.book;
    expect(stageGate(plain, trusted, ["shift"], ["shift"])).toBeUndefined();
  });

  it("says it in one line", () => {
    const t = makeText("npc-cook = the cook\nscene-shift = Work a shift\nplace-noodle_shop = Noodle Shop\nquiet-stage-gate = { $people } ({ $count }): { $scene } ({ $place })", "en");
    expect(stageGateText(course, t, { stage: 2, npcs: ["cook"], scene: "shift" })).toBe("the cook (1): Work a shift (Noodle Shop)");
  });
});
