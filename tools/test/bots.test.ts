import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { addErrand, fixtureCourse } from "@silver-tongue/core/testing";
import { BOTS, goals, runBot } from "../src/bots";
import { buildCourse } from "../src/build-course";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

describe("course bots (real content)", () => {
  const { course } = buildCourse(CONTENT, "zh-china-en");
  const oneOff = course!.scenes.filter((s) => !s.repeatable).map((s) => s.id);
  const reports = Object.fromEntries(Object.entries(BOTS).map(([name, bot]) => [name, runBot(course!, bot, { days: 14, seed: 7 })]));

  it("the always-right player finishes every one-off scene", () => {
    expect(Object.keys(reports.right.firstDone).sort()).toEqual([...oneOff].sort());
  });

  it("no player ever runs out of scenes to play", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.deadEndDays, name).toBe(0);
  });

  it("a player with no money can always still earn some", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.brokeWithoutWork, name).toBe(0);
  });

  it("every player reads the mentor's notes and meets words", () => {
    for (const [name, r] of Object.entries(reports)) {
      expect(r.notesRead, name).toBe(course!.notes.length);
      expect(r.wordsHeard, name).toBeGreaterThan(10);
    }
  });

  it("the always-right player delivers parcels", () => {
    expect(reports.right.errands).toBeGreaterThan(0);
  });

  it("the core never refuses a bot's input", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.rejected, name).toBe(0);
  });

  it("is repeatable with the same seed", () => {
    expect(runBot(course!, BOTS.learner, { days: 5, seed: 3 })).toEqual(runBot(course!, BOTS.learner, { days: 5, seed: 3 }));
  });
});

describe("course bots (a world with a home)", () => {
  it("walk home to sleep, so every day ends and nothing is refused", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    for (const [name, bot] of Object.entries(BOTS)) {
      const r = runBot(c, bot, { days: 3, seed: 7 });
      expect(r.rejected, name).toBe(0);
      expect(r.firstDone.intro, name).toBe(1);
    }
  });

  it("stop at the first refused input instead of repeating it", () => {
    const c = fixtureCourse();
    c.world.places.attic = { links: [] };
    c.world.home = "attic";
    expect(runBot(c, BOTS.right, { days: 3, seed: 7 }).rejected).toBe(1);
  });
});

describe("course bots (a world with an errand)", () => {
  it("walks a parcel to where it goes, and counts it", () => {
    const c = addErrand(fixtureCourse());
    const r = runBot(c, BOTS.right, { days: 3, seed: 1 });
    expect(r.errands).toBeGreaterThan(0);
    expect(r.rejected).toBe(0);
  });
});

describe("course bots (a world with a shop)", () => {
  it("shop only when a week's rent is left over, and never go broke doing it", () => {
    const c = fixtureCourse();
    for (const v of Object.values(c.scenes[1].exchanges[0].variants)) v.cost = 1; // the shift now also buys something
    c.world.rentPerWeek = 1000; // nobody ever has a week's rent spare
    expect(runBot(c, BOTS.right, { days: 3, seed: 1 }).shopping).toBe(0);
    c.world.rentPerWeek = 0; // now there's always a week's rent spare
    const r = runBot(c, BOTS.right, { days: 3, seed: 1 });
    expect(r.shopping).toBeGreaterThan(0);
    expect(r.rejected).toBe(0);
  });

  it("still pays for a first visit that costs something, since it's the story", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].cost = 1; // meeting the cook costs ¥1
    c.world.rentPerWeek = 1000;
    const r = runBot(c, BOTS.right, { days: 2, seed: 1 });
    expect(r.firstDone.intro).toBe(1);
  });
});

describe("course bots (money)", () => {
  it("counts wages, shopping, late rent and the wallet left after rent", () => {
    const c = fixtureCourse();
    c.world.rentPerWeek = 1000; // never payable
    const late = runBot(c, BOTS.right, { days: 8, seed: 1 });
    expect(late.earned).toBeGreaterThan(0);
    expect(late.rentLateNights).toBeGreaterThan(0);
    expect(late.minAfterRent).toBe(Infinity);
    c.world.rentPerWeek = 1; // always payable
    const paid = runBot(c, BOTS.right, { days: 8, seed: 1 });
    expect(paid.rentLateNights).toBe(0);
    expect(paid.minAfterRent).toBeLessThan(Infinity);
    expect(paid.shoppingSpent).toBe(0);
  });

  it("puts paid work before story when rent is close and money is short", () => {
    const c = fixtureCourse();
    c.scenes.push({ ...structuredClone(c.scenes[0]), id: "chat", after: ["intro"] });
    c.world.rentPerWeek = 50;
    c.world.foodPerDay = 5;
    const base = { ...newGame(c), place: "noodle_shop", scenesDone: { intro: 1 }, trust: { cook: 2 } };
    const first = (patch: object) => (goals(c, { ...base, ...patch })[0].input as { scene: string }).scene;
    expect(first({ day: 2, wallet: 5 })).toBe("chat"); // rent is days away: story first
    expect(first({ day: 6, wallet: 5 })).toBe("shift"); // rent due tomorrow night, not enough money
    expect(first({ day: 7, wallet: 5 })).toBe("shift"); // rent due tonight
    expect(first({ day: 6, wallet: 500 })).toBe("chat"); // enough money: story first
    expect(first({ day: 3, wallet: 5, rentLate: true })).toBe("chat"); // late, but days till the next try: story (the landlord waits)
  });
});
