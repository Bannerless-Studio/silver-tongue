import { describe, expect, it } from "vitest";
import { newGame, type CatalogEntry } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { makeText, settingsRows } from "../src/index";

const catalog: CatalogEntry[] = [
  { id: "test-course", language: "zh", setting: "s", learners: ["en", "bn"], learnerNames: { en: "English", bn: "বাংলা" } },
  { id: "ja-town", language: "ja", setting: "t", learners: ["bn"], learnerNames: { bn: "বাংলা" } },
];

describe("settings rows", () => {
  const course = fixtureWithText();
  const t = makeText(course.learnerFtl + "\nlanguage-ja = Japanese\n", "en");
  const ctx = { course, catalog, state: newGame(course), t, audioAvailable: true };

  it("main: learning, reading, sound", () => {
    const rows = settingsRows("main", ctx);
    expect(rows.map((r) => r.action)).toEqual([{ kind: "open", screen: "course" }, { kind: "open", screen: "reading" }, { kind: "sound" }]);
    expect(rows[0].label).toContain("Chinese");
    expect(rows[1].label).toContain("English");
  });

  it("course: the current one goes back; another switches, keeping the reading language if it can", () => {
    const rows = settingsRows("course", ctx);
    expect(rows[0].action).toEqual({ kind: "back" });
    expect(rows[1]).toMatchObject({ label: "Japanese", action: { kind: "switch", course: "ja-town", learner: "bn" } });
  });

  it("reading: each reading language of this course", () => {
    const rows = settingsRows("reading", ctx);
    expect(rows.map((r) => r.action)).toEqual([{ kind: "back" }, { kind: "switch", course: "test-course", learner: "bn" }]);
    expect(rows[1].label).toBe("বাংলা");
  });

  it("says when there is no sound", () => {
    expect(settingsRows("main", { ...ctx, audioAvailable: false })[2].label).toContain(t("settings-sound-none"));
  });
});
