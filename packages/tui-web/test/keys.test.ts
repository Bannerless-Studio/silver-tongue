import { describe, expect, it } from "vitest";
import { keyName } from "../src/keys";

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
});
