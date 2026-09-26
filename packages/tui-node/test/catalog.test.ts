import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { clipsDir, courseFile, coursesDir, readCatalog } from "../src/catalog";

const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "st-cat-"));
  temps.push(d);
  return d;
};

describe("catalog", () => {
  it("uses SILVER_TONGUE_COURSES when set", () => {
    expect(coursesDir({ SILVER_TONGUE_COURSES: "/x" })).toBe("/x");
  });

  it("reads the index and names course files", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "index.json"), JSON.stringify([{ id: "a", language: "zh", setting: "s", learners: ["en"], learnerNames: { en: "English" } }]));
    expect(readCatalog(dir).map((e) => e.id)).toEqual(["a"]);
    expect(courseFile(dir, "a", "en")).toBe(join(dir, "a", "en.json"));
  });

  it("finds clips beside the course when bundled", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "a", "audio"), { recursive: true });
    expect(clipsDir(dir, { id: "a", language: "zh" })).toBe(join(dir, "a", "audio"));
  });
});
