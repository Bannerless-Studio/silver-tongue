import { spawn as nodeSpawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { playbackRate, type AudioOut, type Speech, type SpeechSpeed } from "@silver-tongue/tui";

export interface Player {
  cmd: string;
  args: string[];
}

/** Command-line players, most common first, each told to stay quiet and open no window. */
export const PLAYERS: Player[] = [
  { cmd: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet"] },
  { cmd: "mpv", args: ["--no-video", "--really-quiet"] },
  { cmd: "mpg123", args: ["-q"] },
  { cmd: "afplay", args: [] },
];

/** Whether a program by this name can be run from a folder on PATH. */
export function onPath(cmd: string, path = process.env.PATH ?? ""): boolean {
  return path
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => {
      try {
        accessSync(join(dir, cmd), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
}

export const findPlayer = (has: (cmd: string) => boolean): Player | undefined => PLAYERS.find((p) => has(p.cmd));

/**
 * Extra args to play a clip at `rate` (already rounded by playbackRate). ffplay, mpv and afplay
 * each take the rate their own way; mpg123 has no clean rate control, so the clip plays unchanged.
 */
export function rateArgs(cmd: string, rate: number): string[] {
  const r = String(rate);
  if (cmd === "ffplay") return ["-af", `atempo=${r}`];
  if (cmd === "mpv") return [`--speed=${r}`];
  if (cmd === "afplay") return ["-r", r];
  return [];
}

export interface Proc {
  kill(): void;
  /** exit gets the exit code, or null when the player was killed */
  on(ev: "exit", cb: (code: number | null) => void): void;
  on(ev: "error", cb: () => void): void;
}

export interface NodeAudioDeps {
  /** the folder of <clip>.mp3 files */
  dir: string;
  player: Player | undefined;
  spawn: (cmd: string, args: string[]) => Proc;
  wait: (ms: number, cb: () => void) => { cancel(): void };
  /** the speed the player chose, read fresh for each clip so a change takes effect live; default "fast" (no change) */
  rate?: () => SpeechSpeed;
}

const BEAT_MS = 300;
/** Clips failing one after another: no clip folder, or no sound device. */
const FAILS_TO_GIVE_UP = 3;

interface QueuedClip {
  clip: string;
  slow: boolean;
}

/**
 * Plays clips by running a player program once per clip, with a beat between them, at the rate
 * `deps.rate` currently says (slower still for a slow repeat). A player that fails turns sound off
 * for the session.
 */
export function createNodeAudio(deps: NodeAudioDeps): AudioOut & { player: Player | undefined } {
  let broken = !deps.player;
  let queue: QueuedClip[] = [];
  let proc: Proc | undefined;
  let timer: { cancel(): void } | undefined;
  let run = 0; // each play() or stop() starts a new run; callbacks from an older one do nothing
  let fails = 0;

  const breakDown = () => {
    broken = true;
    queue = [];
  };

  const next = (mine: number) => {
    timer = undefined;
    if (mine !== run || broken) return;
    const item = queue.shift();
    if (!item) return;
    try {
      const rate = playbackRate(deps.rate ? deps.rate() : "fast", item.slow);
      const args = [...deps.player!.args, ...rateArgs(deps.player!.cmd, rate), join(deps.dir, `${item.clip}.mp3`)];
      const p = deps.spawn(deps.player!.cmd, args);
      proc = p;
      p.on("error", breakDown);
      p.on("exit", (code) => {
        if (mine !== run) return; // killed by stop(): not a failure
        proc = undefined;
        fails = code === 0 ? 0 : fails + 1;
        if (fails >= FAILS_TO_GIVE_UP) return breakDown();
        if (queue.length) timer = deps.wait(BEAT_MS, () => next(mine));
      });
    } catch {
      breakDown();
    }
  };

  const stop = () => {
    run++;
    queue = [];
    timer?.cancel();
    timer = undefined;
    proc?.kill();
    proc = undefined;
  };

  return {
    get available() {
      return !broken;
    },
    get busy() {
      // Broken drops the queue for good, so there is nothing left to wait for, whatever proc still says.
      return !broken && (proc !== undefined || timer !== undefined);
    },
    play(lines: Speech[]) {
      stop();
      if (broken) return;
      queue = lines.flatMap((l) => l.clips.map((clip) => ({ clip, slow: !!l.slow })));
      next(run);
    },
    stop,
    // The chosen player, so a caller can tell when it's one (mpg123) that ignores speed.
    player: deps.player,
  };
}

/** The real thing: the first player on PATH, run with no terminal input or output. */
export function nodeAudioDeps(dir: string, rate?: () => SpeechSpeed): NodeAudioDeps {
  return {
    dir,
    // Without its clips there's nothing to play, and the footer should say so.
    player: existsSync(dir) ? findPlayer((c) => onPath(c)) : undefined,
    spawn: (cmd, args) => nodeSpawn(cmd, args, { stdio: "ignore" }),
    rate,
    wait: (ms, cb) => {
      const h = setTimeout(cb, ms);
      return { cancel: () => clearTimeout(h) };
    },
  };
}
