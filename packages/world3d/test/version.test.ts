// The build's version (src/version.ts): the corner tag VERSION ("v0.14.0") and the full stamp BUILD
// ("v0.14.0 · <sha> · <UTC time>") as build.mjs makes them, the tag rendered into the HUD (page.css
// .build-version; the loading card and the title screen use the same tag but aren't covered here),
// and the Settings screen's full "Version: …" line (.settings-version).
import { newGame } from "@silver-tongue/core";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HudView } from "../src/ui/hud";
import { BUILD, VERSION, versionLine, versionTag } from "../src/version";
import { installFakeDom, type FakeElement } from "./fake-dom";
import { course, makeGame } from "./helpers";

describe("VERSION and BUILD", () => {
  it("the corner tag and the full stamp, the full one starting with the tag", () => {
    expect(VERSION).toBe("vtest"); // vitest.config.ts `define`
    expect(BUILD).toBe("vtest · 0000000 · 2026-01-01 00:00");
    expect(BUILD.startsWith(`${VERSION} · `)).toBe(true);
  });

  it("build.mjs: the tag is v + tui-node's version, the full stamp adds the sha and a UTC time without the word", () => {
    const build = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
    expect(build).toContain('"packages", "tui-node", "package.json"');
    expect(build).toContain("const tag = `v${pkg}${dirty ? \"+\" : \"\"}`;");
    expect(build).toContain('full: `${tag} · ${sha} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`');
  });
});

describe("the corner tag (page.css .build-version)", () => {
  it("is in the HUD, with the version as its text", () => {
    installFakeDom();
    const { game } = makeGame(newGame(course));
    const { t, s } = game;
    const hud = new HudView(s, t, () => {});
    const node = hud.node as unknown as FakeElement;
    const tag = node.querySelector(".build-version")!;
    expect(tag).not.toBeNull();
    expect(tag.textContent).toBe(VERSION);
    expect(tag.getAttribute("aria-hidden")).toBe("true");
  });

  it("versionTag() makes a fresh node each time (the HUD, the loading card and the title screen each get their own)", () => {
    installFakeDom();
    const a = versionTag() as unknown as FakeElement;
    const b = versionTag() as unknown as FakeElement;
    expect(a).not.toBe(b);
    expect(a.textContent).toBe(VERSION);
  });
});

describe("the Settings screen's full line (page.css .settings-version)", () => {
  it('reads "Version: <the full stamp>" in English', () => {
    installFakeDom();
    const { game } = makeGame(newGame(course));
    const line = versionLine(game.s) as unknown as FakeElement;
    expect(line.className).toBe("settings-version");
    expect(line.textContent).toBe(`Version: ${BUILD}`);
  });
});
