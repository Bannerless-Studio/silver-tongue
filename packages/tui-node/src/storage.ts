import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { newGame, parseSave, serialize, type Course, type GameState } from "@silver-tongue/core";

/** Where saves live: $XDG_CONFIG_HOME or ~/.config, and %APPDATA% on Windows. */
export function configDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform, home = homedir()): string {
  if (platform === "win32") return env.APPDATA || join(home, "AppData", "Roaming");
  return env.XDG_CONFIG_HOME || join(home, ".config");
}

export interface Loaded {
  state: GameState;
  /** a message id to show once at start */
  notice?: string;
  /** true when the save couldn't be read or backed up: play on without saving, so it is never overwritten */
  readOnly: boolean;
}

/** A save that won't parse is kept as a backup and the game starts fresh. */
export function loadSave(course: Course, path: string): Loaded {
  try {
    if (!existsSync(path)) return { state: newGame(course), readOnly: false };
    const parsed = parseSave(readFileSync(path, "utf8"), course);
    if (parsed.ok) return { state: parsed.state, readOnly: false };
    renameSync(path, `${path}.invalid-backup`);
    return { state: newGame(course), notice: "notice-bad-save", readOnly: false };
  } catch {
    return { state: newGame(course), notice: "notice-read-only", readOnly: true };
  }
}

/**
 * Writes the save so that a crash or power loss leaves the old save or the new one, never
 * half of one. Returns false if it couldn't be written.
 */
export function writeSave(path: string, state: GameState): boolean {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, serialize(state));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, path);
    return true;
  } catch {
    return false;
  }
}
