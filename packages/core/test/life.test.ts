import { describe, expect, it } from "vitest";
import { availableSceneIds, changeWallet, endDay, newGame } from "../src/life";
import { fixtureCourse } from "../src/testing/fixture";

describe("life", () => {
  const course = fixtureCourse();

  it("unlocks scenes by order and trust", () => {
    const s = newGame(course);
    expect(availableSceneIds(course, s)).toEqual(["intro"]);
    s.scenesDone.intro = 1;
    expect(availableSceneIds(course, s)).toEqual([]);
    s.trust.cook = 1;
    expect(availableSceneIds(course, s)).toEqual(["shift"]);
  });

  it("never lets the wallet go negative", () => {
    const s = newGame(course);
    expect(changeWallet(s, -100, "food")).toEqual([{ type: "walletChanged", wallet: 0, delta: -20, reason: "food" }]);
    expect(changeWallet(s, -5, "food")).toEqual([]);
  });

  it("charges food daily and rent on day 7; short on rent, the landlord waits", () => {
    const s = newGame(course);
    s.wallet = 100;
    s.day = 7;
    const ev = endDay(course, s);
    expect(ev.map((e) => e.type)).toEqual(["dayEnded", "walletChanged", "walletChanged"]);
    expect(s.wallet).toBe(45);
    expect(s.day).toBe(8);
    expect(s.slot).toBe(0);

    s.wallet = 30;
    s.day = 14;
    endDay(course, s);
    expect(s.rentLate).toBe(true);
    expect(s.wallet).toBe(25);
    s.wallet = 60;
    endDay(course, s);
    expect(s.rentLate).toBe(false);
    expect(s.wallet).toBe(5);
  });
});
