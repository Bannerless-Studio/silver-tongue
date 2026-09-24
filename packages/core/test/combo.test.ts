import { describe, expect, it } from "vitest";
import { allCombos, comboKey, parseComboKey, resolveParams } from "../src/combo";

describe("combo", () => {
  it("keys are order-independent and round-trip", () => {
    expect(comboKey({ item: "tea", count: "three" })).toBe("count=three|item=tea");
    expect(parseComboKey("count=three|item=tea")).toEqual({ count: "three", item: "tea" });
    expect(comboKey({})).toBe("");
    expect(parseComboKey("")).toEqual({});
  });

  it("lists every slot assignment", () => {
    const combos = allCombos({ item: "drinks", count: "nums" }, { drinks: ["tea", "water"], nums: ["three", "four"] });
    expect(combos.map(comboKey)).toEqual([
      "count=three|item=tea",
      "count=three|item=water",
      "count=four|item=tea",
      "count=four|item=water",
    ]);
    expect(allCombos({}, {})).toEqual([{}]);
  });

  it("every combination's key parses back to it", () => {
    for (const c of allCombos({ item: "drinks", count: "nums" }, { drinks: ["tea", "hot_water"], nums: ["three", "4-ish"] })) {
      expect(parseComboKey(comboKey(c))).toEqual(c);
    }
  });

  it("rejects unknown groups", () => {
    expect(() => allCombos({ item: "food" }, {})).toThrow(/unknown group "food"/);
  });

  it("resolves $slot params", () => {
    expect(resolveParams({ action: "serve", item: "$item" }, { item: "tea" })).toEqual({ action: "serve", item: "tea" });
  });
});
