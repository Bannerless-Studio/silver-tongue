import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planAudio, trimClip } from "../src/audio";

const hasFfmpeg = !spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).error;
const duration = (f: string) =>
  Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

describe("planAudio", () => {
  const a = { id: "aaaa", voice: "V", text: "你" };
  const b = { id: "bbbb", voice: "V", text: "好" };

  it("lists clips without a file, and mp3 files nothing needs", () => {
    expect(planAudio([a, b], ["aaaa.mp3", "cccc.mp3", "notes.txt"])).toEqual({ missing: [b], unused: ["cccc.mp3"] });
  });

  it("clears half-made clips a stopped run left behind", () => {
    expect(planAudio([a], ["aaaa.mp3", "aaaa.mp3.part", "bbbb.mp3.part", "aaaa.mp3.part.trim.part"])).toEqual({
      missing: [],
      unused: ["aaaa.mp3.part", "aaaa.mp3.part.trim.part", "bbbb.mp3.part"],
    });
  });

  it("has nothing to do when files and clips match", () => {
    expect(planAudio([a], ["aaaa.mp3"])).toEqual({ missing: [], unused: [] });
  });
});

describe.skipIf(!hasFfmpeg)("trimClip", () => {
  it("cuts the silence edge-tts leaves around a clip, keeping it mono 24 kHz", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-trim-"));
    try {
      const f = join(dir, "c.mp3");
      // 0.3 s silence, 0.5 s tone, 1 s silence: like an edge-tts clip of a short word.
      spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=0.5", "-af", "adelay=300,apad=pad_dur=1", "-ac", "1", "-ar", "24000", f]);
      expect(duration(f)).toBeGreaterThan(1.7);
      expect(trimClip(f)).toBe(true);
      expect(duration(f)).toBeGreaterThan(0.5);
      expect(duration(f)).toBeLessThan(0.8);
      const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=channels,sample_rate", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();
      expect(probe).toBe("24000,1");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("leaves the clip alone and says so when ffmpeg fails", () => {
    expect(trimClip("/no/such/clip.mp3")).toBe(false);
  });
});
