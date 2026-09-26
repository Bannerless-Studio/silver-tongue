// Builds dist/index.html (the app, xterm.js and its CSS in one file) and dist/courses/: the catalog,
// each course file and each course's clips. The page fetches the course it plays, so it needs a web
// server (GitHub Pages, npx serve); it no longer works opened straight from disk.
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const xtermDir = dirname(createRequire(import.meta.url).resolve("@xterm/xterm/package.json"));

const result = await build({
  entryPoints: [join(here, "src", "main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  define: {
    __VERSION__: JSON.stringify(JSON.parse(readFileSync(join(repo, "packages", "tui-node", "package.json"), "utf8")).version),
  },
  legalComments: "none",
});
// "</script" inside the inlined code would end the script element early.
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(xtermDir, "css", "xterm.css"), "utf8") + readFileSync(join(here, "src", "page.css"), "utf8");
const html = readFileSync(join(here, "src", "index.html"), "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "index.html"), html);
const coursesOut = join(here, "dist", "courses");
rmSync(join(here, "dist", "audio"), { recursive: true, force: true }); // where 0.12 kept the clips
rmSync(coursesOut, { recursive: true, force: true });
cpSync(join(repo, "dist", "courses"), coursesOut, { recursive: true });
let clips = 0;
for (const entry of JSON.parse(readFileSync(join(coursesOut, "index.json"), "utf8"))) {
  const src = join(repo, "content", "audio", entry.language);
  if (!existsSync(src)) continue;
  const out = join(coursesOut, entry.id, "audio");
  cpSync(src, out, { recursive: true, filter: (f) => !f.endsWith(".part") });
  clips += readdirSync(out).length;
}
console.log(`built packages/tui-web/dist/index.html (${Math.round(html.length / 1024)} KB) and dist/courses/ with ${clips} clips`);
