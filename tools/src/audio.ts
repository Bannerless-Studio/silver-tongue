import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCourse } from "./build-course";
import type { Clip } from "./voices";

/** Which clips still need making, and which .mp3 files nothing uses any more. */
export function planAudio(clips: Clip[], files: string[]): { missing: Clip[]; unused: string[] } {
  const have = new Set(files.filter((f) => f.endsWith(".mp3")));
  const needed = new Set(clips.map((c) => `${c.id}.mp3`));
  return { missing: clips.filter((c) => !have.has(`${c.id}.mp3`)), unused: [...have].filter((f) => !needed.has(f)).sort() };
}

/** Makes one clip with edge-tts, trying three times. Written to a .part file first, so a failed run leaves nothing half-made. */
function say(clip: Clip, file: string): boolean {
  const tmp = `${file}.part`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = spawnSync("edge-tts", ["--voice", clip.voice, `--text=${clip.text}`, "--write-media", tmp], { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status === 0 && existsSync(tmp)) {
      renameSync(tmp, file);
      return true;
    }
    rmSync(tmp, { force: true });
  }
  return false;
}

function main(): void {
  const courseId = process.argv[2] ?? "zh-china-en";
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { course, errors, clips, audioDir } = buildCourse(join(repo, "content"), courseId);
  // Missing clip files are what this script is for; any other error stops it.
  const other = errors.filter((e) => !e.startsWith("audio: no file for clip "));
  if (!course || !audioDir || other.length) {
    for (const e of other) console.error(`✗ ${e}`);
    process.exit(1);
  }
  mkdirSync(audioDir, { recursive: true });
  const { missing, unused } = planAudio(clips, readdirSync(audioDir));
  if (missing.length && spawnSync("edge-tts", ["--help"], { stdio: "ignore" }).error) {
    console.error("edge-tts not found. Install it with: pipx install edge-tts");
    process.exit(1);
  }
  let made = 0;
  const failed: Clip[] = [];
  for (const c of missing) {
    if (say(c, join(audioDir, `${c.id}.mp3`))) made++;
    else failed.push(c);
    process.stdout.write(`\rmade ${made}/${missing.length}`);
  }
  if (missing.length) process.stdout.write("\n");
  for (const f of unused) rmSync(join(audioDir, f));
  console.log(`clips: ${clips.length} needed, ${made} made, ${unused.length} deleted`);
  for (const c of failed) console.error(`✗ ${c.id} (${c.voice}): ${c.text}`);
  if (failed.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
