import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MUSIC_BUS_CAP, SoundMixer } from "../src/audio";
import { DEFAULT_PREFS } from "../src/prefs";

interface LoudnessMetadata {
  source: string;
  integratedLufs: number;
  lra: number;
  truePeakDb: number;
  durationS: number;
  generated: string;
}

const MUSIC = fileURLToPath(new URL("../assets/audio/music/owner_theme.ogg", import.meta.url));
const METADATA = fileURLToPath(new URL("../assets/audio/music/owner_theme.json", import.meta.url));

function mixer(volume: number) {
  return new SoundMixer({
    base: "",
    manifest: [],
    format: null,
    context: () => null,
    fetchBytes: async () => new ArrayBuffer(0),
    musicVolume: volume,
  });
}

describe("owner theme loudness safety", () => {
  it("ships measured metadata within the file-level limits", () => {
    const measured: LoudnessMetadata = JSON.parse(readFileSync(METADATA, "utf8"));
    expect(measured.source).toBe("assets/audio/source/owner_theme.wav");
    expect(measured.integratedLufs).toBeLessThanOrEqual(-23);
    expect(measured.truePeakDb).toBeLessThanOrEqual(-5);
    expect(measured.lra).toBeLessThanOrEqual(8);
    expect(measured.durationS).toBeGreaterThan(0);
    expect(existsSync(MUSIC)).toBe(true);
  });

  const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  if (!hasFfmpeg) console.warn("SKIP owner_theme.ogg re-measurement: ffmpeg is not on PATH");
  it.skipIf(!hasFfmpeg)("re-measures the shipped Ogg below the release ceilings", () => {
    const result = spawnSync(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", MUSIC, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    const summary = result.stderr.split("Summary:").at(-1) ?? "";
    const integrated = Number(/I:\s+(-?[0-9.]+) LUFS/.exec(summary)?.[1]);
    const peak = Number(/Peak:\s+(-?[0-9.]+) dBFS/.exec(summary)?.[1]);
    expect(integrated).toBeLessThanOrEqual(-22);
    expect(peak).toBeLessThanOrEqual(-4);
  });

  it("caps the mixer even for an out-of-range slider and keeps the default below 0.25", () => {
    expect(mixer(1).musicGain).toBe(MUSIC_BUS_CAP);
    expect(mixer(5).musicGain).toBe(MUSIC_BUS_CAP);
    expect(mixer(DEFAULT_PREFS.music).musicGain).toBeLessThanOrEqual(0.25);
  });
});
