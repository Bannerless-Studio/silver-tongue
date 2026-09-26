// Builds dist/index.html: the app, xterm.js with its CSS, and the built course in one file,
// so the page works from GitHub Pages, a shared link or straight from disk. The clips go in
// dist/audio/ beside it (without them the game plays silently).
import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const courseId = process.argv[2] ?? "zh-china-en";
const course = readFileSync(join(repo, "dist", "courses", courseId, "course.json"), "utf8");
const xtermDir = dirname(createRequire(import.meta.url).resolve("@xterm/xterm/package.json"));

const result = await build({
  entryPoints: [join(here, "src", "main.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  define: {
    __COURSE__: course,
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
const audioOut = join(here, "dist", "audio");
rmSync(audioOut, { recursive: true, force: true });
cpSync(join(repo, "content", "audio", "zh"), audioOut, { recursive: true, filter: (f) => !f.endsWith(".part") });
console.log(`built packages/tui-web/dist/index.html (${Math.round(html.length / 1024)} KB) and ${readdirSync(audioOut).length} clips in dist/audio/`);
