import { describe, expect, it } from "vitest";
import { toAnsi } from "@silver-tongue/tui";
import { keyName } from "../src/node-terminal";

describe("node terminal", () => {
  it("turns styled spans into ANSI escapes", () => {
    expect(toAnsi([{ text: "plain" }])).toBe("plain");
    expect(toAnsi([{ text: "Cook", bold: true, color: "cyan" }, { text: "茶", underline: true }])).toBe(
      "\x1b[1;36mCook\x1b[0m\x1b[4m茶\x1b[0m",
    );
  });

  it("normalises keys", () => {
    expect(keyName("1", { name: "1" })).toBe("1");
    expect(keyName("\r", { name: "return" })).toBe("return");
    expect(keyName("\x03", { name: "c", ctrl: true })).toBe("ctrl-c");
    expect(keyName("？", undefined)).toBe("？");
  });
});
