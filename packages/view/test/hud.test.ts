import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { clock, dayPart, hudValues, makeText, nextGoal } from "../src/index";

describe("hud values", () => {
  it("gives the day, slots, wallet, rank and flags", () => {
    const course = fixtureWithText();
    const state = newGame(course);
    state.errand = { to: "school" };
    state.rentLate = true;
    expect(hudValues(course, state, makeText(course.learnerFtl, "en"), 0)).toEqual({
      day: 1, slot: 0, slots: 4, currency: "¥", wallet: 20, rank: 0, rankLabel: "Pidgin", parcel: true, rentLate: true, rentInDays: 0,
      goal: "Next: Say hello · Noodle shop", clock: "08:00", part: "🌅 morning",
    });
  });

  it("names the part of the day, with its icon, instead of counting slots", () => {
    const course = fixtureWithText();
    const state = newGame(course);
    const t = makeText(course.learnerFtl, "en");
    const parts = [0, 1, 2, 3, 4].map((slot) => dayPart(course, { ...state, slot }, t));
    expect(parts).toEqual(["🌅 morning", "☀️ late morning", "🌤️ afternoon", "🌇 evening", "🌙 night"]);
  });

  it("tells the time: each slot on its hour of an 08:00-20:00 day, a few minutes on per exchange", () => {
    const course = fixtureWithText();
    const state = newGame(course);
    expect(clock(course, state)).toBe("08:00");
    state.slot = 2;
    expect(clock(course, state)).toBe("14:00");
    state.slot = 3; // the third scene of the day, on its second exchange
    state.run = { scene: "intro", exchange: 1, combo: {}, mode: "pick", options: [], tiles: [], misses: 0, earned: 0, mixups: 0 };
    expect(clock(course, state)).toBe("14:09");
    state.run = null;
    state.slot = 4;
    expect(clock(course, state)).toBe("20:00");
  });

  it("points at the next new scene, at bed once time is up, and at nothing when only repeats are left", () => {
    const course = fixtureWithText();
    const t = makeText(course.learnerFtl, "en");
    const state = newGame(course);
    state.place = "noodle_shop";
    expect(nextGoal(course, state, t)).toBe("Next: Say hello"); // here: no place named
    state.scenesDone.intro = 1;
    state.trust.cook = 1; // opens the repeatable shift, which is never a goal
    expect(nextGoal(course, state, t)).toBeUndefined();
    state.slot = 4;
    expect(nextGoal(course, state, t)).toBe("Next: find your bed");
  });

  it("counts the days until rent, which falls at the end of every 7th day", () => {
    const course = fixtureWithText();
    const t = makeText(course.learnerFtl, "en");
    const days = (day: number, rentLate = false) => hudValues(course, { ...newGame(course), day, rentLate }, t, 0).rentInDays;
    expect(days(1)).toBe(6);
    expect(days(6)).toBe(1);
    expect(days(7)).toBe(0);
    expect(days(8)).toBe(6);
    expect(days(3, true)).toBe(0);
  });
});
