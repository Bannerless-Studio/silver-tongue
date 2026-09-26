import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseSave, type Course, type GameState } from "@silver-tongue/core";

/**
 * Each playthrough is a session: one save file in the course's sessions folder.
 * The session played most recently (by file time) is the one the game continues.
 */
export interface Session {
  id: string;
  path: string;
  /** ms since the epoch: when the session was last saved */
  lastPlayed: number;
  state: GameState;
}

export function sessionsDir(configRoot: string, courseId: string): string {
  return join(configRoot, "silver-tongue", "sessions", courseId);
}

/** Readable sessions, most recently played first. Unreadable files and backups are left out. */
export function listSessions(dir: string, course: Course): Session[] {
  if (!existsSync(dir)) return [];
  const out: Session[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const path = join(dir, file);
    try {
      const parsed = parseSave(readFileSync(path, "utf8"), course);
      if (parsed.ok) out.push({ id: file.slice(0, -5), path, lastPlayed: statSync(path).mtimeMs, state: parsed.state });
    } catch {
      // unreadable: not offered
    }
  }
  return out.sort((a, b) => b.lastPlayed - a.lastPlayed || b.id.localeCompare(a.id));
}

/** "2026-09-25-143005" (UTC), from a time in ms. */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");

/** A path for a new session named after when it started; a clash gets -2, -3, … */
export function newSessionPath(dir: string, now: number): string {
  const base = stamp(now);
  let path = join(dir, `${base}.json`);
  for (let n = 2; existsSync(path); n++) path = join(dir, `${base}-${n}.json`);
  return path;
}

/** Moves the single save used before sessions existed (<root>/silver-tongue/<course>.json) into the sessions folder. */
export function migrateLegacySave(configRoot: string, courseId: string): void {
  const legacy = join(configRoot, "silver-tongue", `${courseId}.json`);
  if (!existsSync(legacy)) return;
  const dir = sessionsDir(configRoot, courseId);
  mkdirSync(dir, { recursive: true });
  renameSync(legacy, newSessionPath(dir, statSync(legacy).mtimeMs));
}

/** `<dir>/<name>`, or with -2, -3, … before `.json` (or at the end) when that is taken. */
function freeName(dir: string, name: string): string {
  const [base, ext] = name.endsWith(".json") ? [name.slice(0, -".json".length), ".json"] : [name, ""];
  let path = join(dir, name);
  for (let n = 2; existsSync(path); n++) path = join(dir, `${base}-${n}${ext}`);
  return path;
}

/**
 * A course's saves under its earlier ids come with it: the old single-save files and every file in
 * the old sessions folders (backups too) move into its sessions folder, keeping their times.
 */
export function migrateCourseSessions(configRoot: string, course: { id: string; aliases?: string[] }): void {
  migrateLegacySave(configRoot, course.id);
  const dir = sessionsDir(configRoot, course.id);
  for (const alias of course.aliases ?? []) {
    const legacy = join(configRoot, "silver-tongue", `${alias}.json`);
    if (existsSync(legacy)) {
      mkdirSync(dir, { recursive: true });
      renameSync(legacy, newSessionPath(dir, statSync(legacy).mtimeMs));
    }
    const old = sessionsDir(configRoot, alias);
    if (!existsSync(old)) continue;
    mkdirSync(dir, { recursive: true });
    for (const file of readdirSync(old)) renameSync(join(old, file), freeName(dir, file));
    rmdirSync(old);
  }
}
