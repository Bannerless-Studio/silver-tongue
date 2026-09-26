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
      day: 1, slot: 0, slots: 4, currency: "¥", wallet: 20, rank: 0, rankLabel: "Pidgin", parcel: true, rentLate: true,
    });
  });
});
