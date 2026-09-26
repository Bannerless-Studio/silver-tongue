import { describe, expect, it } from "vitest";
import { nextSpeed, playbackRate, SLOW_RATE_FACTOR, SLOWEST_RATE, SPEED_RATES, SPEEDS } from "../src/index";

describe("playbackRate", () => {
  it("plays at the speed the player chose", () => {
    expect(SPEEDS.map((s) => playbackRate(s))).toEqual([0.7, 0.85, 1]);
  });

  it("plays a slow line at 0.75 of the chosen speed", () => {
    expect(playbackRate("slow", true)).toBeCloseTo(0.525);
    expect(playbackRate("normal", true)).toBeCloseTo(0.6375);
    expect(playbackRate("fast", true)).toBe(0.75);
  });

  it("never plays slower than the floor, however the choices add up", () => {
    expect(SPEED_RATES.slow * SLOW_RATE_FACTOR).toBeGreaterThanOrEqual(SLOWEST_RATE);
  });
});

describe("nextSpeed", () => {
  it("cycles slow, normal, fast and back to slow", () => {
    expect(SPEEDS.map((s) => nextSpeed(s))).toEqual(["normal", "fast", "slow"]);
  });
});
