import { describe, expect, it } from "vitest";
import { forBrowser, keyName } from "../src/keys";

describe("web keys", () => {
  it("maps browser key names to the game's", () => {
    expect(keyName("Enter")).toBe("return");
    expect(keyName("Escape")).toBe("escape");
    expect(keyName("Backspace")).toBe("backspace");
    expect(keyName("ArrowUp")).toBe("up");
    expect(keyName("ArrowDown")).toBe("down");
    expect(keyName("3")).toBe("3");
    expect(keyName("w")).toBe("w");
    expect(keyName("W")).toBe("w");
  });

  it("ignores other keys and anything held with ctrl, alt or meta", () => {
    expect(keyName("Shift")).toBeUndefined();
    expect(keyName("F5")).toBeUndefined();
    expect(keyName("c", { ctrlKey: true })).toBeUndefined();
    expect(keyName("r", { metaKey: true })).toBeUndefined();
  });

  it("reads full-width digits typed with a Chinese input method", () => {
    expect(keyName("１")).toBe("1");
  });

  it("leaves browser shortcuts, function keys and Tab to the browser", () => {
    expect(forBrowser({ key: "r", ctrlKey: true })).toBe(true);
    expect(forBrowser({ key: "c", metaKey: true })).toBe(true);
    expect(forBrowser({ key: "F5" })).toBe(true);
    expect(forBrowser({ key: "Tab" })).toBe(true);
    expect(forBrowser({ key: "1" })).toBe(false);
    expect(forBrowser({ key: "Enter" })).toBe(false);
  });
});
