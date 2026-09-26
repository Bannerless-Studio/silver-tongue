import { describe, expect, it } from "vitest";
import { FALLBACK_NPC, fallbackPlace, loadArt, type GetText } from "../src/art";

const course = { world: { places: { street: {}, shop: {} }, npcs: { wang: {}, cook: {} } } };
const files = (map: Record<string, string>): GetText => async (url) => map[url] ?? null;
const json = JSON.stringify({ places: { street: { tint: "#111111", rim: "#eeeeee", spots: { wang: 0.25 } } } });

describe("art", () => {
  it("uses the course's drawings and art.json", async () => {
    const art = await loadArt("c/", course, files({ "c/art/art.json": json, "c/art/places/street.svg": "<svg>street</svg>", "c/art/npcs/wang.svg": "<svg>wang</svg>" }));
    expect(art.place("street", "Street")).toEqual({ svg: "<svg>street</svg>", tint: "#111111", rim: "#eeeeee", spots: { wang: 0.25 } });
    expect(art.npc("wang")).toBe("<svg>wang</svg>");
    expect(art.spot("street", "wang", ["wang"])).toBe(0.25);
  });

  it("falls back for anything missing, so a course without art still plays", async () => {
    const art = await loadArt("c/", course, files({}));
    expect(art.place("shop", "Shop").svg).toBe(fallbackPlace("Shop"));
    expect(art.npc("cook")).toBe(FALLBACK_NPC);
    expect(art.spot("shop", "cook", ["wang", "cook"])).toBeCloseTo(2 / 3);
  });

  it("a fetch that throws is a missing file", async () => {
    const art = await loadArt("c/", course, async () => {
      throw new Error("offline");
    });
    expect(art.npc("wang")).toBe(FALLBACK_NPC);
  });

  it("escapes the place name in the fallback", () => {
    expect(fallbackPlace("<b>&")).toContain("&lt;b&gt;&amp;");
    expect(fallbackPlace("<b>&")).not.toContain("<b>");
  });
});
