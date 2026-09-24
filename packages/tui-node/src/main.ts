import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCore, mulberry32, type Course } from "@silver-tongue/core";
import { startApp } from "@silver-tongue/tui";
import { createNodeTerminal } from "./node-terminal";
import { configDir, loadSave, writeSave } from "./storage";

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

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`silver-tongue needs Node 22 or newer; this is Node ${process.versions.node}.`);
  process.exit(1);
}

const course = JSON.parse(readFileSync(coursePath(), "utf8")) as Course;
const savePath = process.env.SILVER_TONGUE_SAVE ?? join(configDir(), "silver-tongue", `${course.id}.json`);
const { state, notice, readOnly } = loadSave(course, savePath);
const core = createCore(course, state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
const term = createNodeTerminal();

// Whatever happens, give the player their terminal back.
const bail = (code: number, error?: unknown) => {
  term.close();
  if (error) console.error(error);
  process.exit(code);
};
process.on("uncaughtException", (e) => bail(1, e));
process.on("unhandledRejection", (e) => bail(1, e));
process.on("SIGTERM", () => bail(143));
process.on("SIGHUP", () => bail(129));

startApp({
  course,
  core,
  term,
  now: Date.now,
  notice,
  save: readOnly ? undefined : (s) => writeSave(savePath, s),
  quit: () => bail(0),
});
