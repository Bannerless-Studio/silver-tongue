import { spawn as nodeSpawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { AudioOut, Speech } from "@silver-tongue/tui";

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
}

const BEAT_MS = 300;
/** Clips failing one after another: no clip folder, or no sound device. */
const FAILS_TO_GIVE_UP = 3;

/**
 * Plays clips by running a player program once per clip, with a beat between them. `slow` is
 * ignored: the clip plays as it is. A player that fails turns sound off for the session.
 */
export function createNodeAudio(deps: NodeAudioDeps): AudioOut {
  let broken = !deps.player;
  let queue: string[] = [];
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
    const clip = queue.shift();
    if (!clip) return;
    try {
      const p = deps.spawn(deps.player!.cmd, [...deps.player!.args, join(deps.dir, `${clip}.mp3`)]);
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
      // A broken player will never fire another exit, so only what is still running counts.
      return !broken && (proc !== undefined || timer !== undefined);
    },
    play(lines: Speech[]) {
      stop();
      if (broken) return;
      queue = lines.flatMap((l) => l.clips);
      next(run);
    },
    stop,
  };
}

/** The real thing: the first player on PATH, run with no terminal input or output. */
export function nodeAudioDeps(dir: string): NodeAudioDeps {
  return {
    dir,
    // Without its clips there's nothing to play, and the footer should say so.
    player: existsSync(dir) ? findPlayer((c) => onPath(c)) : undefined,
    spawn: (cmd, args) => nodeSpawn(cmd, args, { stdio: "ignore" }),
    wait: (ms, cb) => {
      const h = setTimeout(cb, ms);
      return { cancel: () => clearTimeout(h) };
    },
  };
}
