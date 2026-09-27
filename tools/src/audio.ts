import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourse, courseIds } from "./build-course";
import type { Clip } from "./voices";

/**
 * Which clips still need making, and which files to delete: .mp3 files nothing uses any more, and
 * .part files a stopped run left half-made. The folder belongs to one course: a second course on
 * the same language would need its clips listed here too, or this deletes them.
 */
export function planAudio(clips: Clip[], files: string[]): { missing: Clip[]; unused: string[] } {
  const stray = (f: string) => f.endsWith(".part");
  const have = new Set(files.filter((f) => f.endsWith(".mp3")));
  const needed = new Set(clips.map((c) => `${c.id}.mp3`));
  const unused = [...[...have].filter((f) => !needed.has(f)), ...files.filter(stray)].sort();
  return { missing: clips.filter((c) => !have.has(`${c.id}.mp3`)), unused };
}

/**
 * edge-tts pads each clip with silence (about 1 s at the end), which makes long gaps between
 * clips. Trim both ends, keeping a short lead-in and tail, and write edge-tts's own format back.
 */
const TRIM = [
  "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB",
  "areverse",
  "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB",
  "areverse",
].join(",");

/** Trims a clip's silence in place with ffmpeg. False (and the clip untouched) if that fails. */
export function trimClip(file: string): boolean {
  const tmp = `${file}.trim.part`; // never .mp3, so nothing ships or commits it half-made
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-af", TRIM, "-ac", "1", "-ar", "24000", "-b:a", "48k", "-f", "mp3", tmp], { stdio: "ignore" });
  if (r.status !== 0 || !existsSync(tmp)) {
    rmSync(tmp, { force: true });
    return false;
  }
  renameSync(tmp, file);
  return true;
}

/** Makes one clip with edge-tts, trying three times. Written to a .part file first, so a failed run leaves nothing half-made. */
function say(clip: Clip, file: string): boolean {
  const tmp = `${file}.part`;
  for (let attempt = 0; attempt < 3; attempt++) {
    // --pitch=-10Hz with "=", so a leading "-" isn't read as a flag
    const args = ["--voice", clip.voice, ...(clip.pitch ? [`--pitch=${clip.pitch}`] : []), ...(clip.rate ? [`--rate=${clip.rate}`] : []), `--text=${clip.text}`, "--write-media", tmp];
    const r = spawnSync("edge-tts", args, { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status === 0 && existsSync(tmp) && trimClip(tmp)) {
      renameSync(tmp, file);
      return true;
    }
    rmSync(tmp, { force: true });
  }
  return false;
}

function main(): void {
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const content = join(repo, "content");
  const given = process.argv.slice(2).find((a) => !a.startsWith("--"));
  // Clips don't depend on the reading language, and courses of one language share a folder: collect
  // each folder's clips from every course first, so unused-clip deletion sees them all.
  const byDir = new Map<string, Clip[]>();
  for (const id of given ? [given] : courseIds(content)) {
    const { course, errors, clips, audioDir } = buildCourse(content, id);
    // Missing clip files are what this script is for; any other error stops it.
    const other = errors.filter((e) => !e.startsWith("audio: no file for clip "));
    if (!course || !audioDir || other.length) {
      for (const e of other) console.error(`✗ ${id}: ${e}`);
      process.exit(1);
    }
    const had = byDir.get(audioDir) ?? [];
    const seen = new Set(had.map((c) => c.id));
    byDir.set(audioDir, [...had, ...clips.filter((c) => !seen.has(c.id))]);
  }
  for (const [audioDir, clips] of byDir) makeClips(audioDir, clips);
}

/** Makes the missing clips in one folder, deletes the ones nothing needs, and trims on --retrim. */
function makeClips(audioDir: string, clips: Clip[]): void {
  mkdirSync(audioDir, { recursive: true });
  const { missing, unused } = planAudio(clips, readdirSync(audioDir));
  const retrim = process.argv.includes("--retrim");
  if (missing.length && spawnSync("edge-tts", ["--help"], { stdio: "ignore" }).error) {
    console.error("edge-tts not found. Install it with: pipx install edge-tts");
    process.exit(1);
  }
  if ((missing.length || retrim) && spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).error) {
    console.error("ffmpeg not found (it trims the silence around each clip). Install it with your package manager.");
    process.exit(1);
  }
  for (const f of unused) rmSync(join(audioDir, f));
  let made = 0;
  const failed: Clip[] = [];
  for (const c of missing) {
    if (say(c, join(audioDir, `${c.id}.mp3`))) made++;
    else failed.push(c);
    process.stdout.write(`\rmade ${made}/${missing.length}`);
  }
  if (missing.length) process.stdout.write("\n");
  // --retrim: trim every clip already made (they were made before clips were trimmed).
  let retrimmed = 0;
  if (retrim) for (const c of clips) if (!missing.includes(c) && trimClip(join(audioDir, `${c.id}.mp3`))) retrimmed++;
  console.log(`clips: ${clips.length} needed, ${made} made, ${unused.length} deleted${retrim ? `, ${retrimmed} trimmed` : ""}`);
  for (const c of failed) console.error(`✗ ${c.id} (${c.voice}): ${c.text}`);
  if (failed.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
