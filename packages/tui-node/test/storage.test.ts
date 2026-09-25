import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { newGame, serialize } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { configDir, loadSave, writeSave } from "../src/storage";

const course = fixtureCourse();
const root = mkdtempSync(join(tmpdir(), "st-save-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("storage", () => {
  it("follows XDG_CONFIG_HOME, and APPDATA on Windows", () => {
    expect(configDir({}, "linux", "/home/a")).toBe("/home/a/.config");
    expect(configDir({ XDG_CONFIG_HOME: "/x" }, "linux", "/home/a")).toBe("/x");
    expect(configDir({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32", "C:\\Users\\a")).toBe("C:\\Users\\a\\AppData\\Roaming");
  });

  it("writes a save and loads it back, leaving no temp file", () => {
    const path = join(root, "a", "game.json");
    const state = newGame(course);
    expect(writeSave(path, state)).toBe(true);
    expect(loadSave(course, path)).toEqual({ state, readOnly: false });
    expect(readdirSync(join(root, "a"))).toEqual(["game.json"]);
  });

  it("keeps a broken save as a backup and starts fresh", () => {
    const path = join(root, "broken.json");
    writeFileSync(path, "{");
    expect(loadSave(course, path)).toMatchObject({ notice: "notice-bad-save", readOnly: false });
    expect(readFileSync(`${path}.invalid-backup`, "utf8")).toBe("{");
  });

  it("never replaces an older backup", () => {
    const path = join(root, "twice.json");
    writeFileSync(path, "{1");
    loadSave(course, path);
    writeFileSync(path, "{2");
    loadSave(course, path);
    const backups = readdirSync(root).filter((f) => f.startsWith("twice.json.invalid-backup"));
    expect(backups).toHaveLength(2);
    expect(backups.map((f) => readFileSync(join(root, f), "utf8")).sort()).toEqual(["{1", "{2"]);
  });

  it("goes read-only when the save can't be read, and reports a failed write", () => {
    const dir = join(root, "is-a-directory.json");
    mkdirSync(dir);
    expect(loadSave(course, dir)).toMatchObject({ notice: "notice-read-only", readOnly: true });
    const blocked = join(root, "file");
    writeFileSync(blocked, serialize(newGame(course)));
    expect(writeSave(join(blocked, "game.json"), newGame(course))).toBe(false);
  });
});
