import { describe, expect, it } from "vitest";
import { keyAction, type KeyContext } from "../src/keys";

const ctx = (patch: Partial<KeyContext> = {}): KeyContext => ({ overlay: false, phase: "explore", typing: false, modifier: false, ...patch });

describe("quiet terminal keys", () => {
  it("digits choose, full-width ones too", () => {
    expect(keyAction("3", ctx())).toEqual({ kind: "choose", n: 2 });
    expect(keyAction("２", ctx({ phase: "pick" }))).toEqual({ kind: "choose", n: 1 });
    expect(keyAction("1", ctx({ phase: "tiles" }))).toEqual({ kind: "choose", n: 0 });
    expect(keyAction("0", ctx())).toBeNull();
  });

  it("tiles: backspace takes one back, enter says it; elsewhere they are the browser's", () => {
    expect(keyAction("Backspace", ctx({ phase: "tiles" }))).toEqual({ kind: "undo" });
    expect(keyAction("Enter", ctx({ phase: "tiles" }))).toEqual({ kind: "send" });
    expect(keyAction("Enter", ctx({ phase: "pick" }))).toBeNull();
  });

  it("? reveals the line, letters open the notebook, status and settings", () => {
    expect(keyAction("?", ctx({ phase: "pick" }))).toEqual({ kind: "reveal" });
    expect(keyAction("？", ctx({ phase: "pick" }))).toEqual({ kind: "reveal" });
    // w: the text game's look-up key, which the shared opening prose mentions
    expect(keyAction("w", ctx({ phase: "pick" }))).toEqual({ kind: "reveal" });
    expect(keyAction("n", ctx())).toEqual({ kind: "open", overlay: "notebook" });
    expect(keyAction("S", ctx())).toEqual({ kind: "open", overlay: "status" });
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

  it("the Book opens with b on a book course; n opens the notebook only without it", () => {
    expect(keyAction("b", ctx({ book: true }))).toEqual({ kind: "open", overlay: "notebook" });
    expect(keyAction("B", ctx({ book: true }))).toEqual({ kind: "open", overlay: "notebook" });
    expect(keyAction("n", ctx({ book: true }))).toBeNull();
    expect(keyAction("n", ctx({ book: false }))).toEqual({ kind: "open", overlay: "notebook" });
    expect(keyAction("b", ctx({ book: false }))).toBeNull();
    expect(keyAction("b", ctx({ book: true, overlay: true }))).toBeNull();
  });

  it("enter does the one bright control on screen; otherwise enter is the browser's", () => {
    expect(keyAction("Enter", ctx({ primary: 2 }))).toEqual({ kind: "choose", n: 2 });
    expect(keyAction("Enter", ctx())).toBeNull();
    expect(keyAction("Enter", ctx({ phase: "pick", primary: 0 }))).toBeNull();
  });
});


it("h thinks on a Book stage and never consumes a typed letter", () => {
  expect(keyAction("h", ctx({ book: true, phase: "pick" }))).toEqual({ kind: "think" });
  expect(keyAction("h", ctx({ book: false, phase: "pick" }))).toBeNull();
  expect(keyAction("h", ctx({ book: true, typing: true }))).toBeNull();
});
