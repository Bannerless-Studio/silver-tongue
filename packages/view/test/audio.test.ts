import { describe, expect, it } from "vitest";
import { clipRate, DEFAULT_SPEED, nextSpeed, playbackRate, SLOW_RATE_FACTOR, SLOWEST_RATE, SPEED_RATES, SPEEDS } from "../src/index";

describe("playbackRate", () => {
  it("plays at the speed the player chose", () => {
    expect(SPEEDS.map((s) => playbackRate(s))).toEqual([0.7, 0.85, 1]);
  });

  it("plays a slow line at 0.75 of the chosen speed, to 2 places", () => {
    expect(playbackRate("slow", true)).toBe(0.53);
    expect(playbackRate("normal", true)).toBe(0.64);
    expect(playbackRate("fast", true)).toBe(0.75);
  });

  it("rounds to 2 places, because the terminal hands the rate to ffplay on a command line", () => {
    for (const speed of SPEEDS) {
      for (const slow of [false, true]) {
        expect(String(playbackRate(speed, slow)).replace(/^-?\d*\./, "").length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("never plays slower than the floor, however the choices add up", () => {
    expect(SPEED_RATES.slow * SLOW_RATE_FACTOR).toBeGreaterThanOrEqual(SLOWEST_RATE);
  });
});

describe("clipRate", () => {
  it("never plays slower than the floor, however slow the caller asks", () => {
    expect(clipRate(0.3, true)).toBe(0.5);
    expect(clipRate(0.4, false)).toBe(0.5);
    expect(clipRate(0.8, false)).toBe(0.8);
  });
});

describe("nextSpeed", () => {
  it("cycles slow, normal, fast and back to slow", () => {
    expect(SPEEDS.map((s) => nextSpeed(s))).toEqual(["normal", "fast", "slow"]);
  });
});

describe("DEFAULT_SPEED", () => {
  it("is slow, so a player who has never opened settings can still copy what they hear", () => {
    expect(DEFAULT_SPEED).toBe("slow");
  });

  it("is the slowest of the rates, whatever order the cycle runs in", () => {
    expect(SPEED_RATES[DEFAULT_SPEED]).toBe(Math.min(...SPEEDS.map((s) => SPEED_RATES[s])));
  });
});
