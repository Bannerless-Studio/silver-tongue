import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCore, mulberry32, type Course } from "@silver-tongue/core";
import { decodeSave, encodeSave, makeText, sessionLines, startApp } from "@silver-tongue/tui";
import { parseFlags, pickAnswer, USAGE } from "./cli";
import { createNodeAudio, nodeAudioDeps } from "./node-audio";
import { createNodeTerminal } from "./node-terminal";
import pkg from "../package.json" with { type: "json" };
import { listSessions, migrateLegacySave, newSessionPath, sessionsDir } from "./sessions";
import { configDir, loadSave, writeSave } from "./storage";

const COURSE = "zh-china-en";

/** Next to the bundle when installed; the repo's dist/ when run from source. */
function coursePath(given?: string): string {
  if (given) return given;
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

const flags = parseFlags(process.argv.slice(2));
if (flags.mode === "version") {
  console.log(pkg.version);
  process.exit(0);
}
if (flags.mode === "help") {
  console.log(USAGE);
  process.exit(0);
}
if (flags.mode === "error") {
  console.error(`silver-tongue: ${flags.message}\n\n${USAGE}`);
  process.exit(2);
}

const courseFile = coursePath(flags.coursePath);
const course = JSON.parse(readFileSync(courseFile, "utf8")) as Course;

/** Clips: in audio/ next to the course when installed; the repo's content/audio/zh when run from source. */
function audioDir(): string {
  const beside = join(dirname(courseFile), "audio");
  const source = fileURLToPath(new URL("../../../content/audio/zh", import.meta.url));
  return existsSync(beside) || !existsSync(source) ? beside : source;
}

/** --export and --import work on the sessions folder and exit without starting the game. */
async function exportOrImport(mode: "export" | "import", line: string): Promise<never> {
  const t = makeText(course.learnerFtl);
  const root = configDir();
  const dir = sessionsDir(root, course.id);
  try {
    migrateLegacySave(root, course.id);
  } catch {
    // listed below as no saves, or the write fails and says so
  }
  if (mode === "export") {
    const last = listSessions(dir, course)[0];
    if (!last) {
      console.error(t("export-none"));
      process.exit(1);
    }
    console.log(await encodeSave(last.state));
    process.exit(0);
  }
  const decoded = await decodeSave(line === "-" ? readFileSync(0, "utf8") : line, course);
  if (!decoded.ok) {
    console.error(t("import-bad", { reason: decoded.reason }));
    process.exit(1);
  }
  const now = Date.now();
  const path = newSessionPath(dir, now);
  if (!writeSave(path, decoded.state)) {
    console.error(t("notice-read-only"));
    process.exit(1);
  }
  const [summary] = sessionLines([{ lastPlayed: now, state: decoded.state }], course, t, (ms) => new Date(ms).toLocaleString());
  console.log(t("import-done", { game: summary.replace(/^1\) /, "") }));
  process.exit(0);
}
if (flags.mode === "export" || flags.mode === "import") await exportOrImport(flags.mode, flags.mode === "import" ? flags.line : "");

/** Which save file to play: the last session, a new one, or one the player picks. */
async function chooseSave(): Promise<string> {
  // SILVER_TONGUE_SAVE pins one save file (for tests and scripts); sessions don't apply.
  if (process.env.SILVER_TONGUE_SAVE) return process.env.SILVER_TONGUE_SAVE;
  const root = configDir();
  const dir = sessionsDir(root, course.id);
  try {
    migrateLegacySave(root, course.id);
  } catch {
    // can't move it: the sessions folder is probably unwritable too, and loadSave will say so
  }
  const sessions = listSessions(dir, course);
  if (flags.mode !== "new" && flags.mode !== "resume") return sessions[0]?.path ?? newSessionPath(dir, Date.now());
  if (flags.mode === "new") return newSessionPath(dir, Date.now());
  const t = makeText(course.learnerFtl);
  if (!sessions.length) {
    console.log(t("resume-none"));
    return newSessionPath(dir, Date.now());
  }
  console.log(t("resume-title"));
  for (const line of sessionLines(sessions, course, t, (ms) => new Date(ms).toLocaleString())) console.log(line);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const pick = pickAnswer(await rl.question(`${t("resume-ask")} `), sessions.length);
      if (pick === "cancel") process.exit(0);
      if (pick !== "again") return sessions[pick].path;
    }
  } finally {
    rl.close();
  }
}

const savePath = await chooseSave();
const { state, notice, readOnly } = loadSave(course, savePath);
const core = createCore(course, state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
const term = createNodeTerminal();
const audio = createNodeAudio(nodeAudioDeps(audioDir()));

// Whatever happens, give the player their terminal back.
const bail = (code: number, error?: unknown) => {
  audio.stop(); // or a player would keep talking after the game has gone
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
  version: pkg.version,
  audio,
  save: readOnly ? undefined : (s) => writeSave(savePath, s),
  quit: () => bail(0),
});
