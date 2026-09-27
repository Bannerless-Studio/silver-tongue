import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeAudio, findPlayer, nodeAudioDeps, onPath, PLAYERS, rateArgs, type Proc } from "../src/node-audio";

type FakeProc = Proc & { exit(code?: number): void; fail(): void; killed: boolean };

function fakes() {
  const spawned: { cmd: string; args: string[]; proc: FakeProc }[] = [];
  const waits: { ms: number; cb: () => void; cancelled: boolean }[] = [];
  const spawn = (cmd: string, args: string[]) => {
    const handlers: Record<string, (code?: number | null) => void> = {};
    const proc: FakeProc = {
      killed: false,
      kill() {
        this.killed = true;
      },
      on(ev: "exit" | "error", cb: (code: number | null) => void) {
        handlers[ev] = (code) => cb(code ?? null);
      },
      exit: (code = 0) => handlers.exit?.(code),
      fail: () => handlers.error?.(),
    };
    spawned.push({ cmd, args, proc });
    return proc;
  };
  const wait = (ms: number, cb: () => void) => {
    const w = { ms, cb, cancelled: false };
    waits.push(w);
    return { cancel: () => void (w.cancelled = true) };
  };
  return { spawned, waits, spawn, wait };
}

const player = PLAYERS[0];
const played = (f: ReturnType<typeof fakes>) => f.spawned.map((s) => s.args.at(-1));

describe("findPlayer", () => {
  it("takes the first player found, in order: ffplay, mpv, mpg123, afplay", () => {
    expect(PLAYERS.map((p) => p.cmd)).toEqual(["ffplay", "mpv", "mpg123", "afplay"]);
    expect(PLAYERS[0].args).toEqual(["-nodisp", "-autoexit", "-loglevel", "quiet"]);
    expect(findPlayer((c) => c === "mpg123" || c === "mpv")).toEqual(PLAYERS[1]);
    expect(findPlayer(() => false)).toBeUndefined();
  });

  it("finds a program on PATH only if it can run", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-path-"));
    try {
      writeFileSync(join(dir, "mpv"), "");
      writeFileSync(join(dir, "ffplay"), "#!/bin/sh\n");
      chmodSync(join(dir, "ffplay"), 0o755);
      expect(onPath("ffplay", dir)).toBe(true);
      expect(onPath("mpv", dir)).toBe(false);
      expect(onPath("afplay", dir)).toBe(false);
      expect(onPath("ffplay", "")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("createNodeAudio", () => {
  it("plays clips one after another, with a 300 ms beat between them", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    expect(a.available).toBe(true);
    a.play([{ clips: ["x", "y"] }, { clips: ["z"], slow: true }]);
    expect(f.spawned[0].cmd).toBe("ffplay");
    expect(played(f)).toEqual(["/a/x.mp3"]);
    f.spawned[0].proc.exit();
    expect(f.waits[0].ms).toBe(300);
    f.waits[0].cb();
    f.spawned[1].proc.exit();
    f.waits[1].cb();
    f.spawned[2].proc.exit();
    expect(played(f)).toEqual(["/a/x.mp3", "/a/y.mp3", "/a/z.mp3"]);
    expect(f.waits).toHaveLength(2);
  });

  it("stop kills the clip playing and drops the rest; a new play does the same", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x", "y"] }]);
    a.stop();
    expect(f.spawned[0].proc.killed).toBe(true);
    f.spawned[0].proc.exit();
    expect(f.waits).toHaveLength(0);
    a.play([{ clips: ["z"] }]);
    a.play([{ clips: ["w"] }]);
    expect(f.spawned[1].proc.killed).toBe(true);
    expect(played(f).at(-1)).toBe("/a/w.mp3");
  });

  it("stop during the beat cancels the next clip", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x", "y"] }]);
    f.spawned[0].proc.exit();
    a.stop();
    expect(f.waits[0].cancelled).toBe(true);
    f.waits[0].cb(); // a timer that fires anyway does nothing
    expect(played(f)).toEqual(["/a/x.mp3"]);
  });

  it("exposes the chosen player, so a caller can tell mpg123 apart (no clean speed control)", () => {
    const mpg123 = PLAYERS.find((p) => p.cmd === "mpg123")!;
    expect(createNodeAudio({ dir: "/a", player, ...fakes() }).player).toBe(player);
    expect(createNodeAudio({ dir: "/a", player: mpg123, ...fakes() }).player?.cmd).toBe("mpg123");
    expect(createNodeAudio({ dir: "/a", player: undefined, ...fakes() }).player).toBeUndefined();
  });

  it("is unavailable with no player, and after a spawn error, and never throws", () => {
    expect(createNodeAudio({ dir: "/a", player: undefined, ...fakes() }).available).toBe(false);
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x"] }]);
    f.spawned[0].proc.fail();
    expect(a.available).toBe(false);
    expect(() => a.play([{ clips: ["y"] }])).not.toThrow();
    expect(f.spawned).toHaveLength(1);
  });

  it("is unavailable after three clips in a row fail to play (no clip folder, no sound device)", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x", "y", "z", "w"] }]);
    f.spawned[0].proc.exit(1);
    f.waits[0].cb();
    f.spawned[1].proc.exit(0);
    f.waits[1].cb();
    f.spawned[2].proc.exit(1);
    f.waits[2].cb();
    f.spawned[3].proc.exit(1);
    expect(a.available).toBe(true);
    a.play([{ clips: ["v"] }]);
    f.spawned[4].proc.exit(1);
    expect(a.available).toBe(false);
  });

  it("a killed clip is not a failure", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    for (let i = 0; i < 4; i++) {
      a.play([{ clips: ["x"] }]);
      a.stop();
      f.spawned[i].proc.exit(1);
    }
    expect(a.available).toBe(true);
  });

  it("has no player without its clip folder", () => {
    expect(nodeAudioDeps("/no/such/folder").player).toBeUndefined();
  });

  it("a spawn that throws marks audio unavailable instead of crashing", () => {
    const a = createNodeAudio({
      dir: "/a",
      player,
      spawn: () => {
        throw new Error("EACCES");
      },
      wait: fakes().wait,
    });
    expect(() => a.play([{ clips: ["x"] }])).not.toThrow();
    expect(a.available).toBe(false);
  });
});

describe("rateArgs", () => {
  it("gives each player its own way to say a rate; mpg123 has none", () => {
    expect(rateArgs("ffplay", 0.7)).toEqual(["-af", "atempo=0.7"]);
    expect(rateArgs("mpv", 0.85)).toEqual(["--speed=0.85"]);
    expect(rateArgs("afplay", 1)).toEqual(["-r", "1"]);
    expect(rateArgs("mpg123", 0.7)).toEqual([]);
  });
});

describe("createNodeAudio: speed", () => {
  it("plays a clip at the rate `rate()` says when it starts, read fresh so a change takes effect live", () => {
    const f = fakes();
    let speed: "slow" | "normal" | "fast" = "slow";
    const a = createNodeAudio({ dir: "/a", player, ...f, rate: () => speed });
    a.play([{ clips: ["x"] }]);
    expect(f.spawned[0].args).toEqual(["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=0.7", "/a/x.mp3"]);
    f.spawned[0].proc.exit();
    speed = "fast";
    a.play([{ clips: ["y"] }, { clips: ["z"], slow: true }]);
    expect(f.spawned[1].args).toEqual(["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=1", "/a/y.mp3"]);
    f.spawned[1].proc.exit();
    f.waits[0].cb();
    // A slow repeat plays slower still: 1 (fast) × 0.75.
    expect(f.spawned[2].args).toEqual(["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=0.75", "/a/z.mp3"]);
  });

  it("without `rate`, plays at the plain rate (no filter added at 1×)", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x"] }]);
    expect(f.spawned[0].args).toEqual(["-nodisp", "-autoexit", "-loglevel", "quiet", "-af", "atempo=1", "/a/x.mp3"]);
  });
});
