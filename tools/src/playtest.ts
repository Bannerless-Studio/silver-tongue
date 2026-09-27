import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

// tools/src/playtest.ts -> tools/src -> tools -> repo root: fixed regardless of the caller's cwd.
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
import { comboKey, createCore, mulberry32, tilePieces, type Course, type GameState, type Input } from "@silver-tongue/core";
import { startApp, type AudioOut, type Speech } from "@silver-tongue/tui";
import { FakeTerminal } from "../../packages/tui/test/fake-terminal";
// Relative, not "silver-tongue/catalog" etc.: those subpath exports point at tui-node's ./src/*.ts,
// which isn't in the published package's "files" (dist only), so only a path within the monorepo
// (as here) can rely on them resolving.
import { clipsDir, coursesDir, courseFile, readCatalog } from "../../packages/tui-node/src/catalog";
import { loadSave, writeSave } from "../../packages/tui-node/src/storage";
import { createNodeAudio, nodeAudioDeps } from "../../packages/tui-node/src/node-audio";

export const USAGE = `Usage: tsx tools/src/playtest.ts [options]

  --run <name>       run id; state lives under .cache/playtest/<name>/ (default "run")
  --resume <name>     continue an existing run's save instead of starting fresh
  --keys "1,1,w,2"    a key script: comma-separated tokens (see below)
  --keys-file <path>  a key script file, one token per line (# comments allowed)
  --cols <n>          terminal width (default 80)
  --rows <n>          terminal height (default 24)
  --seed <n>          RNG seed (default 1)
  --course <id>       course id from dist/courses/index.json (default: the first one)
  --auto <n>          from the current screen, pick the first sensible reply for n steps
  --real-audio        actually play clips (ffplay/mpv/mpg123/afplay) instead of only logging them
  --wall-clock        use the real system clock instead of a fixed, deterministic one
  --help              show this help

Key tokens: a bare character presses that key ("1".."9", a letter, "m", "w", "n", "o", "q", "p", "s", "r", …);
"enter"/"return" -> Return, "esc"/"escape" -> Escape, "backspace"/"bs" -> Backspace,
"up"/"down"/"left"/"right"/"ctrl-c" pass through by name; "type:Ishmum" types that text
character by character, keeping case, as a keyboard would.`;

/** One step of a key script: press a named/literal key, or type a string. */
export type ScriptAction = { op: "press"; name: string } | { op: "type"; text: string };

const NAMED_KEYS: Record<string, string> = {
  enter: "return",
  return: "return",
  esc: "escape",
  escape: "escape",
  backspace: "backspace",
  bs: "backspace",
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  space: " ",
  "ctrl-c": "ctrl-c",
};

/** Parses one key token (already trimmed, non-empty) into a script action. */
export function parseKeyToken(token: string): ScriptAction {
  if (token.startsWith("type:")) return { op: "type", text: token.slice("type:".length) };
  const lower = token.toLowerCase();
  if (lower in NAMED_KEYS) return { op: "press", name: NAMED_KEYS[lower] };
  if ([...token].length !== 1) throw new Error(`unknown key token "${token}" (multi-character tokens must be named or "type:...")`);
  return { op: "press", name: lower };
}

/**
 * A key script from raw text: split on newlines and commas, "#" starts a line comment, blank
 * tokens are dropped. Works for both the inline --keys string and a --keys-file file.
 */
export function parseKeyScript(source: string): ScriptAction[] {
  return source
    .split(/\r?\n/)
    .flatMap((line) => {
      const noComment = line.split("#")[0] ?? "";
      return noComment.split(",");
    })
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(parseKeyToken);
}

/** Sends one script action to the terminal, as a player at the keyboard would. */
function runAction(term: FakeTerminal, action: ScriptAction): void {
  if (action.op === "type") term.type(action.text);
  else term.press(action.name);
}

interface AudioEntry {
  clip: string;
  path: string;
  exists: boolean;
  slow: boolean;
}

/** Records every clip a Speech queue asks for, without playing anything. */
function recordingAudio(dir: string, log: AudioEntry[]): AudioOut {
  return {
    available: true,
    play(lines: Speech[]) {
      for (const line of lines) {
        for (const clip of line.clips) {
          const path = join(dir, `${clip}.mp3`);
          log.push({ clip, path, exists: existsSync(path), slow: !!line.slow });
        }
      }
    },
    stop() {},
  };
}

interface SpawnEntry {
  cmd: string;
  args: string[];
}

/**
 * Records every clip, then actually plays it through the real node audio backend, at the "slow"
 * speed preference (its default) so a run's atempo is predictable. `spawnLog` gets the exact
 * command and args of every player process started, for --real-audio evidence.
 */
function realAudio(dir: string, log: AudioEntry[], spawnLog: SpawnEntry[]): AudioOut {
  const deps = nodeAudioDeps(dir, () => "slow");
  const rawSpawn = deps.spawn;
  const real = createNodeAudio({
    ...deps,
    spawn: (cmd, args) => {
      spawnLog.push({ cmd, args });
      return rawSpawn(cmd, args);
    },
  });
  return {
    get available() {
      return real.available;
    },
    play(lines: Speech[]) {
      for (const line of lines) {
        for (const clip of line.clips) {
          const path = join(dir, `${clip}.mp3`);
          log.push({ clip, path, exists: existsSync(path), slow: !!line.slow });
        }
      }
      real.play(lines);
    },
    stop() {
      real.stop();
    },
  };
}

/** The clip count queued by an audio log entry list added since `from`. */
const clipsSince = (log: AudioEntry[], from: number) => log.length - from;

/**
 * From the current screen, the input a sensible player sends next: the correct pick or correct
 * tiles in a scene, else the first menu item that isn't quit (adapted from tools/src/bots.ts).
 */
function autoInput(course: Course, state: GameState): Input | undefined {
  const run = state.run;
  if (run) {
    if (run.mode === "pick") {
      const good = run.options.indexOf(comboKey(run.combo));
      return { type: "reply", choice: good >= 0 ? good : 0 };
    }
    const ex = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange];
    const used = new Set<number>();
    const order = tilePieces(ex.variants[comboKey(run.combo)].reply).map((p) => {
      const i = run.tiles.findIndex((t, j) => t === p && !used.has(j));
      used.add(i);
      return i;
    });
    return { type: "replyTiles", tiles: order };
  }
  return undefined;
}

/** The scene id in progress, or "explore" when not in one. */
const sceneLabel = (state: GameState) => state.run?.scene ?? "explore";

interface Args {
  run: string;
  resume?: string;
  keys?: string;
  keysFile?: string;
  cols: number;
  rows: number;
  seed: number;
  course?: string;
  auto?: number;
  realAudio: boolean;
  wallClock: boolean;
  help: boolean;
}

/** Run and resume ids become directory names under .cache/playtest/: keep them to safe characters. */
const RUN_NAME_RE = /^[A-Za-z0-9_-]+$/;
function checkRunName(name: string, flag: string): void {
  if (!RUN_NAME_RE.test(name)) throw new Error(`playtest: ${flag} "${name}" must match ${RUN_NAME_RE} (letters, digits, "_", "-")`);
}

export function parsePlaytestArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      run: { type: "string" },
      resume: { type: "string" },
      keys: { type: "string" },
      "keys-file": { type: "string" },
      cols: { type: "string" },
      rows: { type: "string" },
      seed: { type: "string" },
      course: { type: "string" },
      auto: { type: "string" },
      "real-audio": { type: "boolean" },
      "wall-clock": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.run !== undefined) checkRunName(values.run, "--run");
  if (values.resume !== undefined) checkRunName(values.resume, "--resume");
  return {
    run: values.resume ?? values.run ?? "run",
    resume: values.resume,
    keys: values.keys,
    keysFile: values["keys-file"],
    cols: Number(values.cols ?? 80),
    rows: Number(values.rows ?? 24),
    seed: Number(values.seed ?? 1),
    course: values.course,
    auto: values.auto === undefined ? undefined : Number(values.auto),
    realAudio: !!values["real-audio"],
    wallClock: !!values["wall-clock"],
    help: !!values.help,
  };
}

const PLAYTEST_EPOCH = 1_700_000_000_000; // an arbitrary fixed moment, so a run with the same script is reproducible
/** A clock for the run: the real one with --wall-clock, else a fixed one that ticks a second per call. */
function makeClock(wallClock: boolean): () => number {
  if (wallClock) return Date.now;
  let t = PLAYTEST_EPOCH;
  return () => (t += 1000);
}

async function settle(realAudio: boolean, clipCount: number): Promise<void> {
  // The app itself is synchronous; audio plays in a spawned subprocess in the background. With
  // --real-audio there's a human listening, so give each clip a moment before the next key lands.
  await new Promise((r) => setTimeout(r, 0));
  if (realAudio && clipCount > 0) await new Promise((r) => setTimeout(r, Math.min(clipCount * 900, 6000)));
}

async function main(): Promise<void> {
  const args = parsePlaytestArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.resume && args.keys === undefined && args.keysFile === undefined && args.auto === undefined) {
    console.error(`playtest: nothing to do for --resume ${args.resume} (pass --keys, --keys-file or --auto)`);
    process.exit(2);
  }

  const dir = coursesDir();
  if (!dir) {
    console.error("playtest: no built courses found; run: npm run build:course");
    process.exit(1);
  }
  const catalog = readCatalog(dir);
  if (!catalog) {
    console.error("playtest: dist/courses/index.json is missing or damaged; run: npm run build:course");
    process.exit(1);
  }
  const entry = args.course ? catalog.find((e) => e.id === args.course) : catalog[0];
  if (!entry) {
    console.error(`playtest: no course "${args.course}" in the catalog (have: ${catalog.map((e) => e.id).join(", ")})`);
    process.exit(1);
  }
  const learner = entry.learners[0];
  const course = JSON.parse(readFileSync(courseFile(dir, entry.id, learner), "utf8")) as Course;
  const clips = clipsDir(dir, entry);

  const runDir = join(REPO_ROOT, ".cache", "playtest", args.run);
  mkdirSync(runDir, { recursive: true });
  const savePath = join(runDir, "save.json");
  if (args.resume) {
    if (!existsSync(savePath)) {
      console.error(`playtest: no save at ${savePath} to resume (run without --resume first)`);
      process.exit(1);
    }
  } else if (existsSync(savePath)) {
    rmSync(savePath); // a fresh --run starts over, same as a new game
  }

  const { state } = loadSave(course, savePath);
  const now = makeClock(args.wallClock);
  const core = createCore(course, state, { now, rng: mulberry32(args.seed) });

  const audioLog: AudioEntry[] = [];
  const spawnLog: SpawnEntry[] = [];
  const audio = args.realAudio ? realAudio(clips, audioLog, spawnLog) : recordingAudio(clips, audioLog);

  const term = new FakeTerminal(args.cols, args.rows);
  const transcript: string[] = [];
  let previousScreen = "";
  let frameCount = 0;

  const border = "+" + "-".repeat(args.cols) + "+";
  const renderScreen = (): string => {
    const lines = term.screen();
    return [border, ...lines.map((l) => `|${l}|`), border].join("\n");
  };

  const record = (label: string) => {
    frameCount++;
    const screenText = renderScreen();
    transcript.push(`--- #${frameCount} ${label} · scene: ${sceneLabel(core.state)} ---`);
    if (screenText === previousScreen) transcript.push("(no change)");
    else transcript.push(screenText);
    previousScreen = screenText;
  };

  startApp({
    course,
    core,
    term,
    now,
    audio,
    save: (s) => writeSave(savePath, s),
    quit: () => {},
  });
  record("(start)");

  const script: ScriptAction[] = [];
  if (args.keysFile) script.push(...parseKeyScript(readFileSync(args.keysFile, "utf8")));
  if (args.keys) script.push(...parseKeyScript(args.keys));

  for (const action of script) {
    const before = audioLog.length;
    runAction(term, action);
    await settle(args.realAudio, clipsSince(audioLog, before));
    const label = action.op === "type" ? `type:${action.text}` : `key:${action.name}`;
    record(label);
  }

  if (args.auto !== undefined) {
    for (let i = 0; i < args.auto; i++) {
      const input = autoInput(course, core.state);
      const before = audioLog.length;
      if (!input) {
        transcript.push(`--- auto step ${i + 1}: nothing to answer (not in a scene); stopping auto mode ---`);
        break;
      }
      // Drive the app the same way a key press would: send() is private to app.ts, so a matching
      // key is pressed instead, keeping this a script of real key presses like any other.
      const key = autoKeyFor(input, core.state);
      term.press(...key);
      await settle(args.realAudio, clipsSince(audioLog, before));
      record(`auto:${i + 1} (${input.type})`);
    }
  }

  writeFileSync(join(runDir, "transcript.txt"), transcript.join("\n") + "\n");
  writeFileSync(
    join(runDir, "audio.log"),
    audioLog.map((a) => `${a.clip}\t${a.exists ? "ok" : "MISSING"}\t${a.slow ? "slow" : ""}\t${a.path}`).join("\n") + "\n",
  );
  writeFileSync(join(runDir, "state.json"), JSON.stringify(core.state, null, 2));
  if (args.realAudio)
    writeFileSync(join(runDir, "spawn.log"), spawnLog.map((s) => `${s.cmd} ${s.args.join(" ")}`).join("\n") + "\n");

  console.log(`playtest: ${join(runDir, "transcript.txt")}`);
}

/** The key presses that send the given input from the current screen (reply/tiles only). */
function autoKeyFor(input: Input, state: GameState): string[] {
  if (input.type === "reply") return [String(input.choice + 1)];
  if (input.type === "replyTiles") {
    const keys = input.tiles.map((i) => String(i + 1));
    return [...keys, "return"];
  }
  throw new Error(`playtest: auto mode can't drive input "${input.type}" outside a scene`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
