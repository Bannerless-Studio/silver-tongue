import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { createCore, mulberry32, type Core, type Course } from "@silver-tongue/core";
import { decodeSave, encodeSave, makeText, sessionLines, startApp } from "@silver-tongue/tui";
import { forBrowser } from "./keys";
import { createWebTerminal, type WebTerminal } from "./web-terminal";
import { fromLocalStorage, WebSessions, type KeyValue, type Opened } from "./web-storage";

/** The built course, put in by the build (build.mjs), so the page is one self-contained file. */
declare const __COURSE__: Course;
/** The game's version (packages/tui-node/package.json), put in by the build. */
declare const __VERSION__: string;
const course = __COURSE__;
const t = makeText(course.learnerFtl);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// Private windows and blocked site data make localStorage throw: play on without saving.
const noStorage: KeyValue = {
  getItem: () => {
    throw new Error("no storage");
  },
  setItem: () => {
    throw new Error("no storage");
  },
  removeItem: () => {},
  keys: () => [],
};
let kv = noStorage;
try {
  kv = fromLocalStorage(window.localStorage);
} catch {
  // stays noStorage
}
const sessions = new WebSessions(kv, course, Date.now);

const xterm = new XTerm({
  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Noto Sans Mono CJK SC", "Noto Sans Mono", monospace',
  fontSize: 16,
  scrollback: 0,
  theme: { background: "#14171c", foreground: "#d8dee9" },
});
const fit = new FitAddon();
xterm.loadAddon(fit);
xterm.open($("#term"));
// xterm takes every key by default; returning false hands shortcuts and Tab back to the browser.
xterm.attachCustomKeyEventHandler((e) => !forBrowser(e));
// WebGL draws box-drawing characters itself, so the frame is solid; without it the DOM renderer
// uses the font's glyphs, which leave gaps between lines.
try {
  const webgl = new WebglAddon();
  // Phones drop WebGL contexts (a backgrounded tab, low memory): fall back to the DOM renderer
  // and redraw, or the terminal would stay blank.
  webgl.onContextLoss(() => {
    webgl.dispose();
    xterm.refresh(0, xterm.rows - 1);
  });
  xterm.loadAddon(webgl);
} catch {
  // no WebGL: the DOM renderer still works
}
fit.fit();

// For smoke tests: the screen as text (the WebGL renderer draws to a canvas, with no DOM text).
Object.assign(window, {
  silverTongueScreen: () =>
    Array.from({ length: xterm.rows }, (_, i) => xterm.buffer.active.getLine(i)?.translateToString(true) ?? ""),
});

// Refit when the terminal's box changes, not only the window: the header wrapping, a phone keyboard.
new ResizeObserver(() => fit.fit()).observe($("#term-wrap"));
// The "saved" message is for the moment after quitting; the next key clears it.
document.addEventListener("keydown", () => status(""));

let current: { term: WebTerminal; core: Core; id: string } | undefined;
const touch = window.matchMedia("(pointer: coarse)").matches;

function status(text: string) {
  $("#status").textContent = text;
}

function play(opened: Opened) {
  current?.term.dispose();
  xterm.reset();
  const term = createWebTerminal(xterm, fit, window);
  const core = createCore(course, opened.state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
  current = { term, core, id: opened.id };
  status("");
  startApp({
    course,
    core,
    term,
    now: Date.now,
    notice: opened.notice,
    save: opened.readOnly ? undefined : (s) => sessions.save(opened.id, s),
    quit: () => status(t("web-saved")),
  });
  if (!touch) xterm.focus();
}

// The dialog shows one panel at a time: the games list, the export line or the import box.
const dialog = $<HTMLDialogElement>("#dialog");
const body = $("#dialog-body");
function openDialog(...nodes: Node[]) {
  body.replaceChildren(...nodes);
  dialog.showModal();
}
/** A DOM element with properties and children. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Node[]): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = document.createElement(tag);
  Object.assign(node, props);
  node.append(...kids);
  return node;
}

function showGames() {
  const list = sessions.list();
  if (!list.length) return openDialog(el("p", { textContent: t("web-games-none") }));
  const lines = sessionLines(list, course, t, (ms) => new Date(ms).toLocaleString());
  const buttons = list.map((s, i) => {
    const b = el("button", { className: "game", textContent: lines[i].replace(/^\d+\) /, "") });
    b.addEventListener("click", () => {
      dialog.close();
      play(sessions.open(s.id));
    });
    return b;
  });
  openDialog(el("h2", { textContent: t("resume-title") }), ...buttons);
}

async function showExport() {
  if (!current) return;
  const line = await encodeSave(current.core.state);
  const box = el("textarea", { readOnly: true, value: line, rows: 5 });
  const copy = el("button", { textContent: t("web-copy") });
  copy.addEventListener("click", async () => {
    box.select();
    try {
      await navigator.clipboard.writeText(line);
      copy.textContent = t("web-copied");
    } catch {
      document.execCommand?.("copy");
    }
  });
  openDialog(el("h2", { textContent: t("web-export") }), el("p", { textContent: t("web-export-hint") }), box, copy);
}

function showImport() {
  const box = el("textarea", { rows: 5, placeholder: "st1:…" });
  const result = el("p");
  const go = el("button", { textContent: t("web-import-go") });
  go.addEventListener("click", async () => {
    const decoded = await decodeSave(box.value, course);
    if (!decoded.ok) {
      result.textContent = t("import-bad", { reason: decoded.reason });
      return;
    }
    const id = sessions.add(decoded.state);
    if (!id) {
      result.textContent = t("notice-read-only");
      return;
    }
    dialog.close();
    play(sessions.open(id));
  });
  openDialog(el("h2", { textContent: t("web-import") }), el("p", { textContent: t("web-import-hint") }), box, go, result);
}

// Page controls, labelled in the learner's language.
const controls: [string, string, () => void][] = [
  ["#new", "web-new", () => play(sessions.startNew())],
  ["#games", "web-games", showGames],
  ["#export", "web-export", () => void showExport()],
  ["#import", "web-import", showImport],
];
for (const [sel, id, action] of controls) {
  const b = $<HTMLButtonElement>(sel);
  b.textContent = t(id);
  b.addEventListener("click", action);
}
$("#dialog-close").textContent = t("web-close");
$("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (!touch) xterm.focus();
});

// The key bar sends the same key names as the keyboard.
for (const b of document.querySelectorAll<HTMLButtonElement>("#keybar button")) {
  b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus (and the phone keyboard) where it was
  b.addEventListener("click", () => {
    status("");
    current?.term.press(b.dataset.key!);
  });
}

$("#version").textContent = `v${__VERSION__}`;

play(sessions.continueLast());
