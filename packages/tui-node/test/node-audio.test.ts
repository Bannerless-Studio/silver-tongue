import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeAudio, findPlayer, onPath, PLAYERS, type Proc } from "../src/node-audio";

type FakeProc = Proc & { exit(): void; fail(): void; killed: boolean };

function fakes() {
  const spawned: { cmd: string; args: string[]; proc: FakeProc }[] = [];
  const waits: { ms: number; cb: () => void; cancelled: boolean }[] = [];
  const spawn = (cmd: string, args: string[]) => {
    const handlers: Record<string, () => void> = {};
    const proc: FakeProc = {
      killed: false,
      kill() {
        this.killed = true;
      },
      on(ev, cb) {
        handlers[ev] = cb;
      },
      exit: () => handlers.exit?.(),
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
