import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { World } from "@silver-tongue/core";
import { artProblems, MAX_ART_BYTES, NPC_VIEWBOX, PLACE_VIEWBOX, svgProblems } from "../src/art";

const place = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PLACE_VIEWBOX}"><rect width="1600" height="900" fill="#345"/></svg>`;
const npc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${NPC_VIEWBOX}"><path fill="currentColor" d="M0 0h10v10z"/></svg>`;

describe("svg rules", () => {
  it("passes a plain drawing, with a local gradient reference", () => {
    const withGradient = place.replace("<rect", `<defs><linearGradient id="g"/></defs><use href="#g"/><rect`);
    expect(svgProblems("a.svg", withGradient, PLACE_VIEWBOX)).toEqual([]);
  });

  it("wants ids that start with the drawing's own name, since several drawings share one page", () => {
    const withIds = (id: string) => place.replace("<rect", `<defs><linearGradient id="${id}"/></defs><rect fill="url(#${id})"`);
    expect(svgProblems("street.svg", withIds("street-sky"), PLACE_VIEWBOX, "street")).toEqual([]);
    expect(svgProblems("street.svg", withIds("sky"), PLACE_VIEWBOX, "street")).toEqual([`street.svg: id "sky" must start with "street-"`]);
  });

  it("lets through only plain shapes and gradients, however an unsafe part is written", () => {
    const bad = (inner: string) => svgProblems("a.svg", place.replace("<rect", `${inner}<rect`), PLACE_VIEWBOX);
    expect(bad(`<a href=javascript:alert(1)><circle r="1"/></a>`)).toContain("a.svg: no <a>");
    expect(bad(`<a href=javascript:alert(1)><circle r="1"/></a>`)).toContain("a.svg: no links outside the file");
    expect(bad(`<set attributeName="href" to="javascript:x()"/>`)).toContain("a.svg: no <set>");
    expect(bad(`<animate attributeName="href" values="javascript:x()"/>`)).toContain("a.svg: no <animate>");
    expect(bad(`<rect/onclick="x()"/>`)).toContain("a.svg: no event attributes (onclick)");
    expect(bad(`<rect x="a>" onclick="x()"/>`)).toContain("a.svg: no event attributes (onclick)");
    expect(bad(`<style>@import url(https://x/y.css)</style>`)).toContain("a.svg: no <style>");
    expect(bad(`<rect fill="url(https://x/y.svg#g)"/>`)).toContain("a.svg: no links outside the file");
    expect(bad(`<rect style="fill:red"/>`)).toContain("a.svg: no style attribute");
    expect(bad(`<text>hi</text>`)).toContain("a.svg: no <text>");
    expect(bad(`<![CDATA[x]]>`)).toContain("a.svg: no <! or <? declarations");
  });

  it("refuses a wrong viewBox, scripts, event attributes, outside links, images and oversize files", () => {
    expect(svgProblems("a.svg", place, NPC_VIEWBOX)).toEqual([`a.svg: viewBox must be "${NPC_VIEWBOX}"`]);
    expect(svgProblems("a.svg", place.replace("</svg>", "<script>x()</script></svg>"), PLACE_VIEWBOX)).toContain("a.svg: no <script>");
    expect(svgProblems("a.svg", place.replace("<rect", `<rect onclick="x()"`), PLACE_VIEWBOX)).toContain("a.svg: no event attributes (onclick)");
    expect(svgProblems("a.svg", place.replace("<rect", `<use href="http://x/y.svg#a"/><rect`), PLACE_VIEWBOX)).toContain("a.svg: no links outside the file");
    expect(svgProblems("a.svg", place.replace("<rect", `<image href="data:image/png;base64,AA"/><rect`), PLACE_VIEWBOX)).toContain("a.svg: no <image> or <foreignObject>");
    const big = place.replace("</svg>", `<!--${"x".repeat(MAX_ART_BYTES)}--></svg>`);
    expect(svgProblems("a.svg", big, PLACE_VIEWBOX)[0]).toMatch(/^a\.svg: \d+ KB, over 40 KB$/);
  });
});

describe("a setting's art", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const world = {
    places: { street: { links: [] }, shop: { links: [] } },
    npcs: { wang: { place: "street" } },
  } as unknown as World;

  function setting(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "st-art-"));
    dirs.push(dir);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return dir;
  }
  const good = {
    "art.json": JSON.stringify({ places: { street: { tint: "#1a1c24", rim: "#f0c070", spots: { wang: 0.3 } }, shop: { tint: "#222", rim: "#fff", spots: {} } } }),
    "art/places/street.svg": place,
    "art/places/shop.svg": place,
    "art/npcs/wang.svg": npc,
  };

  it("passes when every place and NPC is drawn and placed", () => {
    expect(artProblems(setting(good), world)).toEqual([]);
  });

  it("names what is missing", () => {
    const { ["art/places/shop.svg"]: _s, ["art/npcs/wang.svg"]: _w, ...rest } = good;
    expect(artProblems(setting(rest), world)).toEqual(["art/places/shop.svg: missing", "art/npcs/wang.svg: missing"]);
    expect(artProblems(setting({ ...good, "art.json": "{" }), world)[0]).toMatch(/^art\.json: /);
    const noSpot = JSON.stringify({ places: { street: { tint: "#111", rim: "#fff", spots: {} }, shop: { tint: "#222", rim: "#fff", spots: {} } } });
    expect(artProblems(setting({ ...good, "art.json": noSpot }), world)).toEqual(["art.json: street has no spot for wang (a number from 0 to 1)"]);
    const noShop = JSON.stringify({ places: { street: { tint: "#111", rim: "#fff", spots: { wang: 0.5 } } } });
    expect(artProblems(setting({ ...good, "art.json": noShop }), world)).toEqual(["art.json: no entry for place shop"]);
  });

  it("refuses colours that aren't hex, and drawings for places or NPCs that don't exist", () => {
    const bad = JSON.stringify({ places: { street: { tint: "red", rim: "#fff", spots: { wang: 0.5 } }, shop: { tint: "#222", rim: "#fff", spots: {} } } });
    expect(artProblems(setting({ ...good, "art.json": bad }), world)).toEqual(['art.json: street tint "red" must be a hex colour']);
    expect(artProblems(setting({ ...good, "art/npcs/ghost.svg": npc }), world)).toEqual(["art/npcs/ghost.svg: no such NPC"]);
  });
});
