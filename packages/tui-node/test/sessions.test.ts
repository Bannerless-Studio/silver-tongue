import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { newGame, serialize } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { listSessions, migrateCourseSessions, migrateLegacySave, newSessionPath, sessionsDir } from "../src/sessions";

const course = fixtureCourse();
const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempRoot = () => {
  const d = mkdtempSync(join(tmpdir(), "st-sessions-"));
  temps.push(d);
  return d;
};

/** Writes a session file with a given day and last-modified time (seconds). */
function session(dir: string, id: string, day: number, mtime: number) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.json`);
  writeFileSync(path, serialize({ ...newGame(course), day }));
  utimesSync(path, mtime, mtime);
  return path;
}

describe("sessions", () => {
  it("keeps each course's sessions in its own folder", () => {
    expect(sessionsDir("/c", "zh-china-en")).toBe(join("/c", "silver-tongue", "sessions", "zh-china-en"));
  });

  it("lists readable sessions, most recently played first, and skips anything else", () => {
    const dir = sessionsDir(tempRoot(), course.id);
    session(dir, "a", 3, 1000);
    session(dir, "b", 7, 3000);
    session(dir, "c", 5, 2000);
    writeFileSync(join(dir, "broken.json"), "{");
    writeFileSync(join(dir, "b.json.tmp"), "x");
    writeFileSync(join(dir, "old.json.invalid-backup"), "{");
    const list = listSessions(dir, course);
    expect(list.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(list[0]).toMatchObject({ path: join(dir, "b.json"), lastPlayed: 3_000_000 });
    expect(list[0].state.day).toBe(7);
  });

  it("lists nothing when there is no folder yet", () => {
    expect(listSessions(join(tempRoot(), "nope"), course)).toEqual([]);
  });

  it("names a new session after the time it started, never reusing a name", () => {
    const dir = sessionsDir(tempRoot(), course.id);
    const at = Date.UTC(2026, 8, 25, 14, 30, 5);
    const first = newSessionPath(dir, at);
    expect(first).toBe(join(dir, "2026-09-25-143005.json"));
    session(dir, "2026-09-25-143005", 1, 1);
    expect(newSessionPath(dir, at)).toBe(join(dir, "2026-09-25-143005-2.json"));
  });

  it("moves a save from before sessions existed into the sessions folder", () => {
    const root = tempRoot();
    const legacy = join(root, "silver-tongue", `${course.id}.json`);
    mkdirSync(join(root, "silver-tongue"));
    writeFileSync(legacy, serialize({ ...newGame(course), day: 4 }));
    utimesSync(legacy, 1_700_000_000, 1_700_000_000);
    migrateLegacySave(root, course.id);
    expect(existsSync(legacy)).toBe(false);
    const [only] = listSessions(sessionsDir(root, course.id), course);
    expect(only.state.day).toBe(4);
    expect(only.id).toBe("2023-11-14-221320");
    migrateLegacySave(root, course.id); // nothing left to move
    expect(listSessions(sessionsDir(root, course.id), course)).toHaveLength(1);
    expect(readFileSync(only.path, "utf8")).toContain('"day":4');
  });

  it("moves every alias file, renaming clashes and keeping times", () => {
    const root = tempRoot();
    const oldDir = sessionsDir(root, "old");
    const newDir = sessionsDir(root, "new");
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(oldDir, "2026-09-25-100000.json"), "a");
    writeFileSync(join(oldDir, "2026-09-25-100000.json.invalid-backup"), "b");
    writeFileSync(join(newDir, "2026-09-25-100000.json"), "c");
    utimesSync(join(oldDir, "2026-09-25-100000.json"), 1000, 1000);
    writeFileSync(join(root, "silver-tongue", "old.json"), "legacy");
    utimesSync(join(root, "silver-tongue", "old.json"), 2000, 2000);
    migrateCourseSessions(root, { id: "new", aliases: ["old"] });
    const files = readdirSync(newDir).sort();
    expect(files).toHaveLength(4);
    expect(readFileSync(join(newDir, "2026-09-25-100000.json"), "utf8")).toBe("c");
    expect(readFileSync(join(newDir, "2026-09-25-100000-2.json"), "utf8")).toBe("a");
    expect(statSync(join(newDir, "2026-09-25-100000-2.json")).mtimeMs).toBe(1_000_000);
    expect(readFileSync(join(newDir, "2026-09-25-100000.json.invalid-backup"), "utf8")).toBe("b");
    expect(readFileSync(join(newDir, "1970-01-01-003320.json"), "utf8")).toBe("legacy");
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(join(root, "silver-tongue", "old.json"))).toBe(false);
  });

  it("leaves things as they are when there is nothing to move", () => {
    const root = tempRoot();
    migrateCourseSessions(root, { id: "new", aliases: ["old"] });
    expect(existsSync(sessionsDir(root, "new"))).toBe(false);
  });
});
