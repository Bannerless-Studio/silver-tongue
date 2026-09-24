import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeText, UI_KEYS } from "../src/text";

describe("text", () => {
  const t = makeText("hello = Hello, { $name }!\n");

  it("formats messages and shows the id for a missing one", () => {
    expect(t("hello", { name: "Mei" })).toBe("Hello, Mei!");
    expect(t("nope")).toBe("nope");
  });

  it("never throws on a missing variable", () => {
    expect(t("hello")).toBe("Hello, {$name}!");
  });

  it("the English UI file defines every UI key", () => {
    const en = makeText(readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8"));
    for (const k of UI_KEYS) expect(en(k), k).not.toBe(k);
  });
});
