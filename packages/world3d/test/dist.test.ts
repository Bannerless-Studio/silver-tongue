// scripts/check-dist.mjs, build.mjs's last check on dist/: every start-path script content-hashed
// (Pages caches each file 10 minutes; a plain main.js would come from a recent visit's cache), and
// index.html's entry, and every file it lists, on disk at the size listed (the preloader checks
// what it receives against those sizes). On fixture dirs; the real build runs it on dist/.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error plain JS script, no types
import { checkDist } from "../scripts/check-dist.mjs";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A dist/ with `files` {path: bytes} and an index.html listing `listed` [[url, bytes]] (entry: the first). */
function fixture(files: Record<string, number>, listed: [string, number][]) {
  const d = mkdtempSync(join(tmpdir(), "world3d-dist-"));
  dirs.push(d);
  mkdirSync(join(d, "chunks"));
  for (const [f, n] of Object.entries(files)) writeFileSync(join(d, f), "x".repeat(n));
  const cfg = { files: listed, entry: listed[0]?.[0] };
  writeFileSync(join(d, "index.html"), `<script type="application/json" id="ld-text">${JSON.stringify(cfg)}</script>`);
  return d;
}

describe("the dist check", () => {
  it("a hashed entry and chunks, on disk at the listed sizes: no problems", () => {
    const d = fixture({ "main-ABCD2345.js": 10, "chunks/three-QWER7890.js": 20 }, [
      ["./main-ABCD2345.js", 10],
      ["./chunks/three-QWER7890.js", 20],
    ]);
    expect(checkDist(d)).toEqual([]);
  });

  it("a plain main.js (even unlisted), an entry not on disk, a size other than listed: each named", () => {
    const d = fixture({ "main.js": 5, "chunks/three-QWER7890.js": 21 }, [
      ["./main-ABCD2345.js", 10],
      ["./chunks/three-QWER7890.js", 20],
    ]);
    const bad = checkDist(d);
    expect(bad).toHaveLength(3);
    expect(bad[0]).toMatch(/main\.js: a script without a content hash$/);
    expect(bad[1]).toBe("./main-ABCD2345.js: listed, not in dist/");
    expect(bad[2]).toBe("./chunks/three-QWER7890.js: listed at 20 B, 21 B on disk");
  });

  it("an unhashed entry listed: named", () => {
    const d = fixture({ "main.js": 5 }, [["./main.js", 5]]);
    expect(checkDist(d)).toContain("./main.js: listed without a content hash");
  });
});
