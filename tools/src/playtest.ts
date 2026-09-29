import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

// tools/src/playtest.ts -> tools/src -> tools -> repo root: fixed regardless of the caller's cwd.
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
import { comboKey, createCore, mulberry32, personalize, tilePieces, type Core, type Course, type GameState, type Input } from "@silver-tongue/core";
import { makeText, placeMenu, type MenuItem, type Text } from "@silver-tongue/view";
import { startApp, type AudioOut, type Speech } from "@silver-tongue/tui";
import { FakeTerminal } from "../../packages/tui/test/fake-terminal";
// Relative, not "silver-tongue/catalog" etc.: those subpath exports point at tui-node's ./src/*.ts,
// which isn't in the published package's "files" (dist only), so only a path within the monorepo
// (as here) can rely on them resolving.
import { clipsDir, coursesDir, courseFile, readCatalog } from "../../packages/tui-node/src/catalog";
import { loadSave, writeSave } from "../../packages/tui-node/src/storage";
import { createNodeAudio, nodeAudioDeps } from "../../packages/tui-node/src/node-audio";
import { bedPlace, stepToward } from "./bots";

export const USAGE = `Usage: tsx tools/src/playtest.ts [options]

  --run <name>       run id; state lives under .cache/playtest/<name>/ (default "run")
  --resume <name>     continue an existing run's save instead of starting fresh
  --keys "1,1,w,2"    a key script: comma-separated tokens (see below)
  --keys-file <path>  a key script file, one token per line (# comments allowed)
  --cols <n>          terminal width (default 80)
  --rows <n>          terminal height (default 24)
  --seed <n>          RNG seed (default 1)
  --course <id>       course id from dist/courses/index.json (default: the first one)
  --goto <placeId|Place Name>   from explore mode, walk to that place (shortest path, one menu press per hop)
  --start <sceneId|Scene Name>  from explore mode, walk to the scene's place if needed, then start it
  --play <sceneId|Scene Name>   --start, then --auto until the scene ends (cap 40 steps)
  --sleep             walk to the bed (home, or the start before there is one), then press Sleep
  --keys "1,1,w,2"    a key script: comma-separated tokens (see below)
  --keys-file <path>  a key script file, one token per line (# comments allowed)
  --auto <n>          from the current screen, pick the first sensible reply for n steps
  --real-audio        actually play clips (ffplay/mpv/mpg123/afplay) instead of only logging them
  --wall-clock        use the real system clock instead of a fixed, deterministic one
  --help              show this help

Menu-by-name navigation (--goto, --start, --play, --sleep) resolves against the CURRENT screen's
place menu each step, matching a scene/place by id or by its rendered label (case-insensitive),
never by a fixed menu number: menus shift as scenes unlock, so a script that says "press 4" breaks
the moment the menu changes shape, but "go to Market Street" or "start street-hello" doesn't.
Only --start XOR --play may be given, not both. When several of these are given together, they run
in this fixed order regardless of argument order: --goto, then --start/--play, then --keys/--keys-file,
then --auto, then --sleep. On a fresh run of a course that opens on a name prompt, any of these four
answers it first (types "Player", presses enter), since none of them have a menu to press until then.

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
    if (run.mode === "type") return { type: "replyText", text: personalize(ex.variants[comboKey(run.combo)].reply, state.player ?? "?").text };
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
  goto?: string;
  start?: string;
  play?: string;
  sleep: boolean;
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
      goto: { type: "string" },
      start: { type: "string" },
      play: { type: "string" },
      sleep: { type: "boolean" },
      auto: { type: "string" },
      "real-audio": { type: "boolean" },
      "wall-clock": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.run !== undefined) checkRunName(values.run, "--run");
  if (values.resume !== undefined) checkRunName(values.resume, "--resume");
  if (values.start !== undefined && values.play !== undefined) throw new Error("playtest: pass only one of --start or --play");
  return {
    run: values.resume ?? values.run ?? "run",
    resume: values.resume,
    keys: values.keys,
    keysFile: values["keys-file"],
    cols: Number(values.cols ?? 80),
    rows: Number(values.rows ?? 24),
    seed: Number(values.seed ?? 1),
    course: values.course,
    goto: values.goto,
    start: values.start,
    play: values.play,
    sleep: !!values.sleep,
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
  if (
    args.resume &&
    args.keys === undefined &&
    args.keysFile === undefined &&
    args.auto === undefined &&
    args.goto === undefined &&
    args.start === undefined &&
    args.play === undefined &&
    !args.sleep
  ) {
    console.error(
      `playtest: nothing to do for --resume ${args.resume} (pass --keys, --keys-file, --auto, --goto, --start, --play or --sleep)`,
    );
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

  const t = makeText(course.learnerFtl, course.learner);
  const navCtx: NavCtx = { term, core, course, t, audioLog, realAudio: args.realAudio, record };

  // A course that needsName opens on a name prompt, not the place menu: none of --goto/--start/
  // --play/--sleep have anything to press until it's answered, so a fresh run answers it first,
  // the same way a script that means to reach the menu would need to.
  if (course.needsName && !core.state.player && (args.goto || args.start || args.play || args.sleep)) {
    const before = audioLog.length;
    term.type("Player");
    term.press("return");
    await settle(args.realAudio, clipsSince(audioLog, before));
    record("name:Player");
  }

  if (args.goto) await walkTo(navCtx, resolvePlaceId(course, t, args.goto));
  if (args.start) await startScene(navCtx, resolveSceneId(course, t, args.start));
  if (args.play) await playScene(navCtx, resolveSceneId(course, t, args.play));

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
      sendAuto(term, input, core.state);
      await settle(args.realAudio, clipsSince(audioLog, before));
      record(`auto:${i + 1} (${input.type})`);
    }
  }

  if (args.sleep) await sleepAction(navCtx);

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

/** Everything a navigation helper needs to press a key and record the resulting frame. */
interface NavCtx {
  term: FakeTerminal;
  core: Core;
  course: Course;
  t: Text;
  audioLog: AudioEntry[];
  realAudio: boolean;
  record: (label: string) => void;
}

/** Renders the current place menu's items as "N) label" for an error message. */
function describeMenu(items: MenuItem[]): string {
  return items.map((m, i) => `${i + 1}) ${m.label}`).join("; ");
}

/** Presses the current place menu's `n`-th item (0-indexed) and records the resulting frame. */
async function pressMenuItem(ctx: NavCtx, index: number, label: string): Promise<void> {
  const before = ctx.audioLog.length;
  ctx.term.press(String(index + 1));
  await settle(ctx.realAudio, clipsSince(ctx.audioLog, before));
  ctx.record(label);
}

/** A place id, resolved from either the id itself or its rendered label (case-insensitive). */
export function resolvePlaceId(course: Course, t: Text, arg: string): string {
  if (course.world.places[arg]) return arg;
  const found = Object.keys(course.world.places).find((p) => t(`place-${p}`).toLowerCase() === arg.toLowerCase());
  if (found) return found;
  throw new Error(`playtest: no place "${arg}" (have: ${Object.keys(course.world.places).join(", ")})`);
}

/** A scene id, resolved from either the id itself or its rendered label (case-insensitive). */
export function resolveSceneId(course: Course, t: Text, arg: string): string {
  const found = course.scenes.find((s) => s.id === arg || t(`scene-${s.id}`).toLowerCase() === arg.toLowerCase());
  if (found) return found.id;
  throw new Error(`playtest: no scene "${arg}" (have: ${course.scenes.map((s) => s.id).join(", ")})`);
}

/** The index (0-based, so its key is index+1) of the menu item a nav helper is looking for. */
export function menuIndexFor(
  items: MenuItem[],
  want: { kind: "go"; place: string } | { kind: "talk"; scene: string } | { kind: "sleep" },
): number {
  if (want.kind === "go") return items.findIndex((m) => m.kind === "go" && m.place === want.place);
  if (want.kind === "talk") return items.findIndex((m) => m.kind === "talk" && m.scene === want.scene);
  return items.findIndex((m) => m.kind === "sleep");
}

/**
 * The shortest walk from `from` to `target`, as the sequence of places it passes through
 * (bots.ts `stepToward`, called repeatedly). Pure path math, with no menu or key presses: used to
 * check reachability up front and by tests. Throws if there's no path, or the walk would take more
 * than `capSteps` hops (a course-graph bug, since `stepToward` never revisits a place).
 */
export function computeWalkPath(course: Course, from: string, target: string, capSteps = 50, state?: GameState): string[] {
  const path: string[] = [];
  let at = from;
  while (at !== target) {
    if (path.length >= capSteps) throw new Error(`playtest: walking from "${from}" to "${target}" took more than ${capSteps} steps (possible loop)`);
    const step = stepToward(course, at, new Set([target]), state);
    if (!step) throw new Error(`playtest: no path from "${from}" to "${target}"`);
    path.push(step);
    at = step;
  }
  return path;
}

/**
 * Walks from the current place to `target` by the shortest path, one menu press per hop, each
 * resolved against that step's own current menu (menu numbers shift as the player moves). Errors
 * if not in explore mode or if no path exists.
 */
async function walkTo(ctx: NavCtx, target: string, capSteps = 50): Promise<void> {
  if (ctx.core.state.run) throw new Error(`playtest: can't walk to "${target}", not in explore mode (mid-scene "${ctx.core.state.run.scene}")`);
  computeWalkPath(ctx.course, ctx.core.state.place, target, capSteps, ctx.core.state); // reachability check, error first
  while (ctx.core.state.place !== target) {
    const step = stepToward(ctx.course, ctx.core.state.place, new Set([target]), ctx.core.state)!;
    const items = placeMenu(ctx.course, ctx.core.state, ctx.t);
    const idx = menuIndexFor(items, { kind: "go", place: step });
    if (idx < 0)
      throw new Error(`playtest: no "go to ${step}" item at "${ctx.core.state.place}" (current menu: ${describeMenu(items)})`);
    await pressMenuItem(ctx, idx, `goto:${step}`);
  }
}

/** From explore mode, walks to the scene's place if needed, then presses it in the menu. */
async function startScene(ctx: NavCtx, sceneId: string): Promise<void> {
  if (ctx.core.state.run) throw new Error(`playtest: can't --start "${sceneId}", already in a scene ("${ctx.core.state.run.scene}")`);
  const scene = ctx.course.scenes.find((s) => s.id === sceneId)!;
  if (scene.place !== ctx.core.state.place) await walkTo(ctx, scene.place);
  const items = placeMenu(ctx.course, ctx.core.state, ctx.t);
  const idx = menuIndexFor(items, { kind: "talk", scene: sceneId });
  if (idx < 0)
    throw new Error(
      `playtest: scene "${sceneId}" isn't in the menu at "${ctx.core.state.place}" (locked or already done); current menu: ${describeMenu(items)}`,
    );
  await pressMenuItem(ctx, idx, `start:${sceneId}`);
}

/** `--start`, then repeatedly the first sensible reply (like `--auto`) until the scene ends. */
async function playScene(ctx: NavCtx, sceneId: string, capSteps = 40): Promise<void> {
  await startScene(ctx, sceneId);
  for (let i = 0; i < capSteps && ctx.core.state.run; i++) {
    const input = autoInput(ctx.course, ctx.core.state);
    if (!input) break;
    const before = ctx.audioLog.length;
    sendAuto(ctx.term, input, ctx.core.state);
    await settle(ctx.realAudio, clipsSince(ctx.audioLog, before));
    ctx.record(`play:${sceneId}:${i + 1}`);
  }
}

/** Walks to the bed (home, or the start before there is one) and presses Sleep. */
async function sleepAction(ctx: NavCtx): Promise<void> {
  if (ctx.core.state.run) throw new Error(`playtest: can't --sleep, not in explore mode (mid-scene "${ctx.core.state.run.scene}")`);
  const bed = bedPlace(ctx.course, ctx.core.state);
  if (bed && ctx.core.state.place !== bed) await walkTo(ctx, bed);
  const items = placeMenu(ctx.course, ctx.core.state, ctx.t);
  const idx = menuIndexFor(items, { kind: "sleep" });
  if (idx < 0) throw new Error(`playtest: no Sleep item at "${ctx.core.state.place}" (current menu: ${describeMenu(items)})`);
  await pressMenuItem(ctx, idx, "sleep");
}

/** Types a typed reply and presses enter; presses the keys for any other reply. */
function sendAuto(term: FakeTerminal, input: Input, state: GameState): void {
  if (input.type === "replyText") {
    term.type(input.text);
    term.press("return");
  } else term.press(...autoKeyFor(input, state));
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
