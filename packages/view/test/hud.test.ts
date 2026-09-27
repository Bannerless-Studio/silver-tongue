import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { hudValues, makeText } from "../src/index";

describe("hud values", () => {
  it("gives the day, slots, wallet, rank and flags", () => {
    const course = fixtureWithText();
    const state = newGame(course);
    state.errand = { to: "school" };
    state.rentLate = true;
    expect(hudValues(course, state, makeText(course.learnerFtl, "en"), 0)).toEqual({
      day: 1, slot: 0, slots: 4, currency: "¥", wallet: 20, rank: 0, rankLabel: "Pidgin", parcel: true, rentLate: true, rentInDays: 0,
    });
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
