// The quiet terminal page (forked from packages/vn-web/build.mjs). Builds dist/index.html (the app, Preact and the CSS in one file) and dist/courses/ (catalog, course
// files, clips), which the page fetches, so it needs a web server like the text page.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyCourses } from "../web-common/copy-courses.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");

const result = await build({
  entryPoints: [join(here, "src", "main.tsx")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  jsx: "automatic",
  jsxImportSource: "preact",
  define: {
    __VERSION__: JSON.stringify(JSON.parse(readFileSync(join(repo, "packages", "tui-node", "package.json"), "utf8")).version),
  },
  legalComments: "none",
});
// "</script" inside the inlined code would end the script element early.
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(here, "src", "quiet.css"), "utf8");
const html = readFileSync(join(here, "src", "index.html"), "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js);
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist", "index.html"), html);
const clips = copyCourses(repo, join(here, "dist", "courses"));
console.log(`built packages/quiet-web/dist/index.html (${Math.round(html.length / 1024)} KB) and dist/courses/ with ${clips} clips`);
