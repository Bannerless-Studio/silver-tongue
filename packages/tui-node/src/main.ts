import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCore, mulberry32, newGame, parseSave, serialize, type Course, type GameState } from "@silver-tongue/core";
import { startApp } from "@silver-tongue/tui";
import { createNodeTerminal } from "./node-terminal";

const COURSE = "zh-china-en";

/** Next to the bundle when installed; the repo's dist/ when run from source. */
function coursePath(): string {
  if (process.argv[2]) return process.argv[2];
  const candidates = [
    new URL(`./courses/${COURSE}/course.json`, import.meta.url),
    new URL(`../../../dist/courses/${COURSE}/course.json`, import.meta.url),
  ].map((u) => fileURLToPath(u));
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error(`No built course found. Run: npm run build:course`);
    process.exit(1);
  }
  return found;
}

function loadState(course: Course, path: string): { state: GameState; notice?: string } {
  if (!existsSync(path)) return { state: newGame(course) };
  const parsed = parseSave(readFileSync(path, "utf8"), course);
  if (parsed.ok) return { state: parsed.state };
  renameSync(path, `${path}.invalid-backup`);
  return { state: newGame(course), notice: "notice-bad-save" };
}

function saveState(path: string, state: GameState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, serialize(state));
  renameSync(`${path}.tmp`, path);
}

const course = JSON.parse(readFileSync(coursePath(), "utf8")) as Course;
const savePath = process.env.SILVER_TONGUE_SAVE ?? join(homedir(), ".config", "silver-tongue", `${course.id}.json`);
const { state, notice } = loadState(course, savePath);
const core = createCore(course, state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
const term = createNodeTerminal();
startApp({
  course,
  core,
  term,
  now: Date.now,
  notice,
  save: (s) => saveState(savePath, s),
  quit: () => {
    term.close();
    process.exit(0);
  },
});
