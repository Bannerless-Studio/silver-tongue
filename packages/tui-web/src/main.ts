import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { createCore, mulberry32, type CatalogEntry, type Core, type Course } from "@silver-tongue/core";
import {
  chooseStart,
  courseLabels,
  decodeSave,
  encodeSave,
  learnerFor,
  makeText,
  sessionLines,
  startApp,
  type Text,
} from "@silver-tongue/tui";
import { forBrowser } from "./keys";
import { createWebAudio } from "./web-audio";
import { createWebTerminal, type WebTerminal } from "./web-terminal";
import {
  fromLocalStorage,
  loadWebSettings,
  migrateWebAliases,
  saveWebSettings,
  WebSessions,
  type KeyValue,
  type Opened,
} from "./web-storage";

/** The game's version (packages/tui-node/package.json), put in by the build. */
declare const __VERSION__: string;
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

// The course being played, in its reading language; set by loadCourse before the first game.
let catalog: CatalogEntry[] = [];
let course: Course;
let t: Text | undefined;
let sessions: WebSessions | undefined;
let audio: ReturnType<typeof createWebAudio> | undefined;
/** The reading-language text; only called once a course has loaded. */
const tx: Text = Object.assign((id: string, args?: Parameters<Text>[1]) => (t ? t(id, args) : id), { has: (id: string) => !!t?.has(id) });

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
document.addEventListener("keydown", () => {
  if ($("#status").textContent === tx("web-saved")) status("");
});

let current: { term: WebTerminal; core: Core; id: string } | undefined;
const touch = window.matchMedia("(pointer: coarse)").matches;

function status(text: string) {
  $("#status").textContent = text;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

// Page controls, labelled in the reading language once a course is loaded.
const controls: [string, string, () => void][] = [
  ["#new", "web-new", () => play(sessions!.startNew())],
  ["#games", "web-games", showGames],
  ["#export", "web-export", () => void showExport()],
  ["#import", "web-import", showImport],
];

/** Loads a course file, moves its old games, and labels the page in its reading language. */
async function loadCourse(entry: CatalogEntry, learner: string) {
  course = await fetchJson<Course>(`courses/${entry.id}/${learner}.json`);
  t = makeText(course.learnerFtl, course.learner);
  document.documentElement.lang = course.learner;
  migrateWebAliases(kv, course);
  sessions = new WebSessions(kv, course, Date.now);
  audio?.stop();
  // One audio element per course; its clips sit in courses/<course>/audio/.
  audio = createWebAudio({
    base: `courses/${entry.id}/audio/`,
    audio: typeof Audio === "undefined" ? undefined : new Audio(),
    wait: (ms, cb) => {
      const h = setTimeout(cb, ms);
      return { cancel: () => clearTimeout(h) };
    },
  });
  saveWebSettings(kv, { course: entry.id, learner });
  for (const [sel, id] of controls) $(sel).textContent = tx(id);
  $("#dialog-close").textContent = tx("web-close");
}

/** Another course or reading language, chosen on the settings screen. */
async function switchTo(id: string, learner: string) {
  const entry = catalog.find((e) => e.id === id);
  if (!entry) return;
  const keep = id === course.id ? current?.id : undefined;
  try {
    await loadCourse(entry, learner);
  } catch {
    // The file didn't come: go on with the game being played.
    return play(keep !== undefined ? sessions!.open(keep) : sessions!.continueLast());
  }
  // Another reading language keeps the game; another course continues its last one.
  play(keep !== undefined ? sessions!.open(keep) : sessions!.continueLast());
}

function play(opened: Opened) {
  audio?.stop();
  current?.term.dispose();
  xterm.reset();
  const term = createWebTerminal(xterm, fit, window, {
    touch,
    // A phone keyboard only opens from a tap, and the page can't tell whether it's showing,
    // so during name entry on a touch screen, say where to tap.
    onTextEntry: (active) => status(active && touch ? tx("web-tap-to-type") : ""),
  });
  const core = createCore(course, opened.state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
  current = { term, core, id: opened.id };
  status("");
  startApp({
    course,
    core,
    term,
    now: Date.now,
    notice: opened.notice,
    save: opened.readOnly ? undefined : (s) => sessions!.save(opened.id, s),
    audio,
    quit: () => {
      audio?.stop();
      status(tx("web-saved"));
    },
    settings: { courses: catalog, switchTo: (id, learner) => void switchTo(id, learner) },
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
  const list = sessions!.list();
  if (!list.length) return openDialog(el("p", { textContent: tx("web-games-none") }));
  const lines = sessionLines(list, course, tx, (ms) => new Date(ms).toLocaleString());
  const buttons = list.map((s, i) => {
    const b = el("button", { className: "game", textContent: lines[i].replace(/^\d+\) /, "") });
    b.addEventListener("click", () => {
      dialog.close();
      play(sessions!.open(s.id));
    });
    return b;
  });
  openDialog(el("h2", { textContent: tx("resume-title") }), ...buttons);
}

async function showExport() {
  if (!current) return;
  const line = await encodeSave(current.core.state);
  const box = el("textarea", { readOnly: true, value: line, rows: 5 });
  const copy = el("button", { textContent: tx("web-copy") });
  copy.addEventListener("click", async () => {
    box.select();
    try {
      await navigator.clipboard.writeText(line);
      copy.textContent = tx("web-copied");
    } catch {
      document.execCommand?.("copy");
    }
  });
  openDialog(el("h2", { textContent: tx("web-export") }), el("p", { textContent: tx("web-export-hint") }), box, copy);
}

function showImport() {
  const box = el("textarea", { rows: 5, placeholder: "st1:…" });
  const result = el("p");
  const go = el("button", { textContent: tx("web-import-go") });
  go.addEventListener("click", async () => {
    const decoded = await decodeSave(box.value, course);
    if (!decoded.ok) {
      result.textContent = tx("import-bad", { reason: decoded.reason });
      return;
    }
    const id = sessions!.add(decoded.state);
    if (!id) {
      result.textContent = tx("notice-read-only");
      return;
    }
    dialog.close();
    play(sessions!.open(id));
  });
  openDialog(el("h2", { textContent: tx("web-import") }), el("p", { textContent: tx("web-import-hint") }), box, go, result);
}

// The buttons do nothing until a course has loaded.
for (const [sel, , action] of controls) {
  $<HTMLButtonElement>(sel).addEventListener("click", () => {
    if (sessions) action();
  });
}
$("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  if (!touch) xterm.focus();
});

// The key bar sends the same key names as the keyboard.
for (const b of document.querySelectorAll<HTMLButtonElement>("#keybar button")) {
  b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus (and the phone keyboard) where it was
  b.addEventListener("click", () => {
    if ($("#status").textContent === tx("web-saved")) status("");
    current?.term.press(b.dataset.key!);
  });
}

$("#version").textContent = `v${__VERSION__}`;

/** The catalog, then the course the settings name (or the only one), or a list to choose from. */
async function boot() {
  const settings = loadWebSettings(kv);
  try {
    catalog = await fetchJson<CatalogEntry[]>("courses/index.json");
    const picked = chooseStart(catalog, settings);
    if ("error" in picked) throw new Error(picked.error);
    if (!picked.ask) {
      await loadCourse(picked.course, picked.learner);
      return play(sessions!.continueLast());
    }
    // Several courses and none chosen yet: list them, named in the first course's reading language.
    await loadCourse(catalog[0], learnerFor(catalog[0], settings.learner));
  } catch {
    // No course text has loaded, so there is no reading language to say this in.
    status("The game could not load. Serve this page from a web server and reload.");
    return;
  }
  const labels = courseLabels(catalog, tx);
  const buttons = catalog.map((entry, i) => {
    const b = el("button", { className: "game", textContent: labels[i].replace(/^\d+\) /, "") });
    b.addEventListener("click", async () => {
      // Load first: closing the dialog would otherwise start the first course.
      await loadCourse(entry, learnerFor(entry, settings.learner)).catch(() => {});
      dialog.close();
    });
    return b;
  });
  // Closing the list without choosing plays the first course, so the page is never left empty.
  dialog.addEventListener("close", () => current || play(sessions!.continueLast()), { once: true });
  openDialog(el("h2", { textContent: tx("start-title") }), ...buttons);
}
void boot();
