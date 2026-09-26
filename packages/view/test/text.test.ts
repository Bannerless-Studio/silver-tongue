import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeText, uiTextProblems } from "../src/index";

describe("text", () => {
  const t = makeText("hello = Hello, { $name }!\n", "en");

  it("formats messages and shows the id for a missing one", () => {
    expect(t("hello", { name: "Mei" })).toBe("Hello, Mei!");
    expect(t("nope")).toBe("nope");
  });

  it("never throws on a missing variable", () => {
    expect(t("hello")).toBe("Hello, {$name}!");
  });

  it("the English UI file defines every UI message with the variables the TUI passes", () => {
    const en = readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8");
    expect(uiTextProblems(en, "en")).toEqual([]);
  });

  it("reports missing messages and unknown variables", () => {
    const broken = "hud = Day { $dya }\n";
    const problems = uiTextProblems(broken, "en");
    expect(problems).toContain('learner text "hud": Unknown variable: $dya');
    expect(problems).toContain('learner text: missing "menu-title"');
  });
  it("formats numbers in the reading language's locale", () => {
    const t = makeText("n = { $n }", "de");
    expect(t("n", { n: 1234.5 })).toBe("1.234,5");
  });
});
