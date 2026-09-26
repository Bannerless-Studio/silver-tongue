import { describe, expect, it } from "vitest";
import { keyAction, type KeyContext } from "../src/keys";

const ctx = (patch: Partial<KeyContext> = {}): KeyContext => ({ overlay: false, phase: "explore", typing: false, modifier: false, ...patch });

describe("visual novel keys", () => {
  it("space and enter move a beat on", () => {
    expect(keyAction(" ", ctx({ phase: "beat" }))).toEqual({ kind: "advance" });
    expect(keyAction("Enter", ctx({ phase: "beat" }))).toEqual({ kind: "advance" });
  });

  it("digits choose, full-width ones too", () => {
    expect(keyAction("3", ctx())).toEqual({ kind: "choose", n: 2 });
    expect(keyAction("２", ctx({ phase: "pick" }))).toEqual({ kind: "choose", n: 1 });
    expect(keyAction("1", ctx({ phase: "tiles" }))).toEqual({ kind: "choose", n: 0 });
    expect(keyAction("0", ctx())).toBeNull();
  });

  it("tiles: backspace takes one back, enter says it", () => {
    expect(keyAction("Backspace", ctx({ phase: "tiles" }))).toEqual({ kind: "undo" });
    expect(keyAction("Enter", ctx({ phase: "tiles" }))).toEqual({ kind: "send" });
  });

  it("letters open the notebook, backlog and settings, and toggle sound", () => {
    expect(keyAction("n", ctx())).toEqual({ kind: "open", overlay: "notebook" });
    expect(keyAction("l", ctx())).toEqual({ kind: "open", overlay: "backlog" });
    expect(keyAction("o", ctx())).toEqual({ kind: "open", overlay: "settings" });
    expect(keyAction("m", ctx())).toEqual({ kind: "sound" });
    expect(keyAction("r", ctx({ phase: "pick" }))).toEqual({ kind: "replay" });
  });

  it("with an overlay open only Escape does anything", () => {
    expect(keyAction("1", ctx({ overlay: true }))).toBeNull();
    expect(keyAction("n", ctx({ overlay: true }))).toBeNull();
    expect(keyAction("Escape", ctx({ overlay: true }))).toEqual({ kind: "close" });
  });

  it("typing a name and browser shortcuts never reach the game", () => {
    expect(keyAction("1", ctx({ typing: true }))).toBeNull();
    expect(keyAction("n", ctx({ phase: "name" }))).toBeNull();
    expect(keyAction("n", ctx({ modifier: true }))).toBeNull();
  });
});
