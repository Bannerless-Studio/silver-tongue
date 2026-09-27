// The build's version (src/version.ts): a non-empty stamp, its muted corner tag rendered into the
// HUD (page.css .build-version; the loading card and the title screen use the same tag but aren't
// covered here), and the Settings screen's full "Version: …" line (.settings-version).
import { newGame } from "@silver-tongue/core";
import { describe, expect, it } from "vitest";
import { HudView } from "../src/ui/hud";
import { VERSION, versionLine, versionTag } from "../src/version";
import { installFakeDom, type FakeElement } from "./fake-dom";
import { course, makeGame } from "./helpers";

describe("VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
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
  it('reads "Version: <version>" in English', () => {
    installFakeDom();
    const { game } = makeGame(newGame(course));
    const line = versionLine(game.s) as unknown as FakeElement;
    expect(line.className).toBe("settings-version");
    expect(line.textContent).toBe(`Version: ${VERSION}`);
  });
});
