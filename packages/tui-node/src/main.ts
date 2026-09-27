import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { createCore, mulberry32, type CatalogEntry, type Course, type GameState } from "@silver-tongue/core";
import {
  chooseStart,
  courseLabels,
  decodeSave,
  encodeSave,
  learnerFor,
  makeText,
  sessionLines,
  startApp,
  type PlayerSettings,
  type SpeechSpeed,
} from "@silver-tongue/tui";
import { clipsDir, courseFile, coursesDir, readCatalog } from "./catalog";
import { parseFlags, pickAnswer, USAGE } from "./cli";
import { createNodeAudio, nodeAudioDeps } from "./node-audio";
import { createNodeTerminal } from "./node-terminal";
import pkg from "../package.json" with { type: "json" };
import { listSessions, migrateCourseSessions, newSessionPath, sessionsDir } from "./sessions";
import { configDir, loadSave, loadSettings, updateSettings, writeSave } from "./storage";

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
/** The flags of a game to play (help, version and errors have exited above). */
const game = flags;

const root = configDir();
// How fast clips are said; unset means "slow". Changed live from the settings screen, and
// remembered for the player's next game too.
let speed: SpeechSpeed = loadSettings(root).speed ?? "slow";

/** A course to play: its file, its clips, and where it sits in the catalog (none for a course file given by path). */
interface Chosen {
  course: Course;
  clips: string;
  catalog: CatalogEntry[];
  /** the catalog's folder; absent for a course file given by path, which can't switch */
  dir?: string;
}

const DAMAGED = "The installed courses are damaged. Reinstall silver-tongue, or run: npm run build:course";

const readCourse = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Course;

/** Before the game starts, a course file that won't read ends with a message rather than a stack. */
function orExit<T>(read: () => T, message: string): T {
  try {
    return read();
  } catch {
    console.error(message);
    process.exit(1);
  }
}

function loadCourse(dir: string, entry: CatalogEntry, learner: string, catalog: CatalogEntry[]): Chosen {
  return { course: readCourse(courseFile(dir, entry.id, learner)), clips: clipsDir(dir, entry), catalog, dir };
}

/** The course: a file given by path, else the one --learn, the settings or the player choose. */
async function start(): Promise<Chosen> {
  if (game.coursePath) {
    // A course built from source: no catalog, no settings, no switching.
    const path = game.coursePath;
    const course = orExit(() => readCourse(path), `silver-tongue: can't read the course file ${path}`);
    return { course, clips: join(dirname(path), "audio"), catalog: [] };
  }
  const dir = coursesDir();
  if (!dir) {
    console.error("No built courses found. Run: npm run build:course");
    process.exit(1);
  }
  const catalog = readCatalog(dir);
  if (!catalog) {
    console.error(DAMAGED);
    process.exit(1);
  }
  const settings = loadSettings(root);
  const picked = chooseStart(catalog, settings, { learn: game.learn, read: game.read });
  if ("error" in picked) {
    console.error(`silver-tongue: ${picked.error}\n\n${USAGE}`);
    process.exit(2);
  }
  // Asking needs a player at the keyboard, and --export/--import keep stdin and stdout for the save line.
  if (picked.ask && (game.mode === "export" || game.mode === "import" || !process.stdin.isTTY)) {
    console.error(`silver-tongue: there are several courses; choose one with --learn\n\n${USAGE}`);
    process.exit(2);
  }
  const entry = picked.ask ? await askCourse(dir, catalog, settings) : picked.course;
  const learner = picked.ask ? learnerFor(entry, game.read, settings.learner) : picked.learner;
  const chosen = orExit(() => loadCourse(dir, entry, learner, catalog), DAMAGED);
  updateSettings(root, { course: entry.id, learner });
  return chosen;
}

/** A numbered list of courses, named in the saved reading language when a course has it. */
async function askCourse(dir: string, catalog: CatalogEntry[], settings: PlayerSettings): Promise<CatalogEntry> {
  const labelled = catalog.find((e) => settings.learner !== undefined && e.learners.includes(settings.learner)) ?? catalog[0];
  const code = learnerFor(labelled, settings.learner);
  const t = makeText(orExit(() => readCourse(courseFile(dir, labelled.id, code)), DAMAGED).learnerFtl, code);
  console.log(t("start-title"));
  for (const line of courseLabels(catalog, t)) console.log(line);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const pick = pickAnswer(await rl.question(`${t("start-ask")} `), catalog.length);
      if (pick === "cancel") process.exit(0);
      if (pick !== "again") return catalog[pick];
    }
  } finally {
    rl.close();
  }
}

/** The course's sessions folder, with saves made under its earlier ids moved in. */
function sessionsFor(course: Course): string {
  try {
    migrateCourseSessions(root, course);
  } catch {
    // can't move them: the folder is probably unwritable too, and loadSave will say so
  }
  return sessionsDir(root, course.id);
}

/** --export and --import work on the sessions folder and exit without starting the game. */
async function exportOrImport({ course }: Chosen, mode: "export" | "import", line: string): Promise<never> {
  const t = makeText(course.learnerFtl, course.learner);
  const dir = sessionsFor(course);
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

/** The course's most recent session, or a new one. */
function lastOrNew(course: Course): string {
  const dir = sessionsFor(course);
  return listSessions(dir, course)[0]?.path ?? newSessionPath(dir, Date.now());
}

/** Which save file to play: the last session, a new one, or one the player picks. */
async function chooseSave({ course }: Chosen): Promise<string> {
  // SILVER_TONGUE_SAVE pins one save file (for tests and scripts); sessions don't apply.
  if (process.env.SILVER_TONGUE_SAVE) return process.env.SILVER_TONGUE_SAVE;
  if (game.mode !== "new" && game.mode !== "resume") return lastOrNew(course);
  const dir = sessionsFor(course);
  if (game.mode === "new") return newSessionPath(dir, Date.now());
  const sessions = listSessions(dir, course);
  const t = makeText(course.learnerFtl, course.learner);
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

const chosen = await start();
if (game.mode === "export" || game.mode === "import") await exportOrImport(chosen, game.mode, game.mode === "import" ? game.line : "");
const firstSave = await chooseSave(chosen);

const term = createNodeTerminal();
let audio: ReturnType<typeof createNodeAudio> | undefined;

// Whatever happens, give the player their terminal back.
const bail = (code: number, error?: unknown) => {
  audio?.stop(); // or a player would keep talking after the game has gone
  term.close();
  if (error) console.error(error);
  process.exit(code);
};
process.on("uncaughtException", (e) => bail(1, e));
process.on("unhandledRejection", (e) => bail(1, e));
process.on("SIGTERM", () => bail(143));
process.on("SIGHUP", () => bail(129));

/** Plays a save file; `carried` is the game as played before a reading-language switch, kept even if it couldn't be saved. */
function play(session: Chosen, savePath: string, carried?: { state: GameState; readOnly: boolean; notice?: string }) {
  audio?.stop();
  const { state, notice, readOnly } = carried ?? loadSave(session.course, savePath);
  const core = createCore(session.course, state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
  audio = createNodeAudio(nodeAudioDeps(session.clips, () => speed));
  const { dir } = session;
  // mpg123 has no clean rate control (see rateArgs): offering a Speed row that does nothing would
  // be worse than not offering it.
  const speedOption =
    audio.player?.cmd === "mpg123"
      ? undefined
      : {
          value: speed,
          onChange: (s: SpeechSpeed) => {
            speed = s;
            updateSettings(root, { speed: s });
          },
        };
  startApp({
    course: session.course,
    core,
    term,
    now: Date.now,
    notice,
    version: pkg.version,
    audio,
    speed: speedOption,
    save: readOnly ? undefined : (s) => writeSave(savePath, s),
    quit: () => bail(0),
    settings: dir
      ? {
          courses: session.catalog,
          switchTo: (id, learner, played) => {
            const entry = session.catalog.find((e) => e.id === id)!;
            let next: Chosen;
            try {
              next = loadCourse(dir, entry, learner, session.catalog);
            } catch {
              // The course file is missing or damaged: go on with the game being played.
              return play(session, savePath, { state: played, readOnly });
            }
            updateSettings(root, { course: id, learner });
            // Another reading language keeps the game; another course continues its last one.
            if (id === session.course.id) play(next, savePath, { state: played, readOnly });
            else play(next, lastOrNew(next.course));
          },
        }
      : undefined,
  });
}

play(chosen, firstSave);
