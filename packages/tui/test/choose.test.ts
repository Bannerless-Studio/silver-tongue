import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@silver-tongue/core";
import { chooseStart, courseLabels, parseSettings } from "../src/choose";
import { makeText } from "../src/text";

const zh: CatalogEntry = { id: "zh-china", language: "zh", setting: "china-city", learners: ["en"], learnerNames: { en: "English" } };
const xx: CatalogEntry = { id: "xx-town", language: "xx", setting: "town", learners: ["en", "fr"], learnerNames: { en: "English", fr: "Français" } };

describe("player settings", () => {
  it("reads a course and a reading language", () => {
    expect(parseSettings('{"course":"zh-china","learner":"en"}')).toEqual({ course: "zh-china", learner: "en" });
  });
  it("ignores garbage, other types and extra fields", () => {
    expect(parseSettings("nope")).toEqual({});
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings("[1]")).toEqual({});
    expect(parseSettings('{"course":3,"learner":"en","x":1}')).toEqual({ learner: "en" });
  });
});

describe("choosing the course at start", () => {
  it("takes --learn by language code or course id", () => {
    expect(chooseStart([zh, xx], {}, { learn: "xx" })).toEqual({ ask: false, course: xx, learner: "en" });
    expect(chooseStart([zh, xx], {}, { learn: "zh-china" })).toEqual({ ask: false, course: zh, learner: "en" });
  });
  it("says so when --learn names nothing", () => {
    expect(chooseStart([zh], {}, { learn: "ja" })).toEqual({ error: 'no course for "ja"' });
  });
  it("takes --read when the course has it, else the saved one, else the first", () => {
    expect(chooseStart([xx], {}, { read: "fr" })).toMatchObject({ learner: "fr" });
    expect(chooseStart([xx], { learner: "fr" }, { read: "de" })).toMatchObject({ learner: "fr" });
    expect(chooseStart([xx], { learner: "de" })).toMatchObject({ learner: "en" });
  });
  it("uses the saved course when the catalog still has it", () => {
    expect(chooseStart([zh, xx], { course: "xx-town" })).toMatchObject({ course: xx });
  });
  it("ignores an unknown saved course: the only course, else ask", () => {
    expect(chooseStart([zh], { course: "gone" })).toMatchObject({ course: zh });
    expect(chooseStart([zh, xx], { course: "gone" })).toEqual({ ask: true });
  });
  it("falls back to the course's first reading language", () => {
    expect(chooseStart([zh], { course: "zh-china", learner: "fr" })).toEqual({ ask: false, course: zh, learner: "en" });
  });
  it("labels courses by language name in the reading language", () => {
    const t = makeText("language-zh = Chinese", "en");
    expect(courseLabels([zh, xx], t)).toEqual(["1) Chinese", "2) xx"]);
  });
});
