import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { toAnsi } from "@silver-tongue/tui";
import { createNodeTerminal, keyName } from "../src/node-terminal";

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

  it("gives keys and resizes only to the newest handler (the app started last)", () => {
    const input = Object.assign(new EventEmitter(), { isTTY: false, setRawMode: () => {}, resume: () => {}, pause: () => {} });
    const output = Object.assign(new EventEmitter(), { write: () => true, columns: 80, rows: 24 });
    const term = createNodeTerminal(input as never, output as never);
    const got: string[] = [];
    term.onKey((k) => got.push(`old ${k.name}`));
    term.onResize(() => got.push("old resize"));
    term.onKey((k) => got.push(`new ${k.name}`));
    term.onResize(() => got.push("new resize"));
    input.emit("keypress", "1", { name: "1" });
    output.emit("resize");
    expect(got).toEqual(["new 1", "new resize"]);
    term.close();
  });
});
