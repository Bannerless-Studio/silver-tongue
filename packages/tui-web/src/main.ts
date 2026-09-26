import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { createCore, mulberry32, type CatalogEntry, type Core, type Course, type GameState } from "@silver-tongue/core";
import {
  chooseStart,
  courseLabels,
  decodeSave,
  DEFAULT_SPEED,
  encodeSave,
  learnerFor,
  makeText,
  playbackRate,
  sessionLines,
  type SpeechSpeed,
  startApp,
  type Text,
} from "@silver-tongue/tui";
import { forBrowser } from "./keys";
import { createWebTerminal, type WebTerminal } from "./web-terminal";
import {
  coursesBase,
  createWebAudio,
  fetchJson,
  fromLocalStorage,
  loadWebSettings,
  metaContent,
  migrateWebAliases,
  updateWebSettings,
  WebSessions,
  type KeyValue,
  type Opened,
} from "@silver-tongue/web-common";

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

// The course being played, in its reading language; set by use() before the first game.
let catalog: CatalogEntry[] = [];
let course: Course;
let t: Text | undefined;
let sessions: WebSessions | undefined;
let audio: ReturnType<typeof createWebAudio> | undefined;
/** How fast clips play, from the player's settings; the audio asks for it per clip. */
let speed: SpeechSpeed = DEFAULT_SPEED;
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

let current: { term: WebTerminal; core: Core; id: string; course: string; readOnly: boolean } | undefined;
const touch = window.matchMedia("(pointer: coarse)").matches;

function status(text: string) {
  $("#status").textContent = text;
}

/** Where the catalog, course files and clips are (the site build points it at the shared folder). */
const base = coursesBase(document);

// Page controls, labelled in the reading language once a course is loaded.
const controls: [string, string, () => void][] = [
  ["#new", "web-new", () => play(sessions!.startNew())],
  ["#games", "web-games", showGames],
  ["#export", "web-export", () => void showExport()],
  ["#import", "web-import", showImport],
];

/** A course file ready to play: its text, its games and its sound. */
interface Loaded {
  course: Course;
  t: Text;
  sessions: WebSessions;
  audio: ReturnType<typeof createWebAudio>;
}

/** Fetches a course file and moves its old games; nothing on the page changes until it is used. */
async function fetchCourse(entry: CatalogEntry, learner: string): Promise<Loaded> {
  const course = await fetchJson<Course>(`${base}${entry.id}/${learner}.json`);
  migrateWebAliases(kv, course);
  return {
    course,
    t: makeText(course.learnerFtl, course.learner),
    sessions: new WebSessions(kv, course, Date.now),
    // One audio element per course; its clips sit in courses/<course>/audio/.
    audio: createWebAudio({
      base: `${base}${entry.id}/audio/`,
      audio: typeof Audio === "undefined" ? undefined : new Audio(),
      wait: (ms, cb) => {
        const h = setTimeout(cb, ms);
        return { cancel: () => clearTimeout(h) };
      },
      rate: () => playbackRate(speed),
    }),
  };
}

/** Makes a loaded course the page's, labelled in its reading language; `remember` keeps it for next time. */
function use(loaded: Loaded, remember: boolean) {
  audio?.stop();
  ({ course, t, sessions, audio } = loaded);
  document.documentElement.lang = course.learner;
  if (remember) updateWebSettings(kv, { course: course.id, learner: course.learner });
  for (const [sel, id] of controls) $(sel).textContent = tx(id);
  $("#dialog-close").textContent = tx("web-close");
  // The visual novel's address, set when both pages are served together (tools/src/site.ts).
  const vn = metaContent(document, "st-vn");
  const link = $<HTMLAnchorElement>("#vn-link");
  link.hidden = !vn;
  link.href = vn;
  link.textContent = tx("vn-play-visual");
}

/** Another course or reading language, chosen on the settings screen. */
async function switchTo(id: string, learner: string, played: GameState) {
  const entry = catalog.find((e) => e.id === id);
  const was = current!;
  // Another reading language goes on with the game as played, saved or not.
  const carried: Opened = { id: was.id, state: played, readOnly: was.readOnly };
  let loaded: Loaded;
  try {
    if (!entry) throw new Error(`no course ${id}`);
    loaded = await fetchCourse(entry, learner);
  } catch {
    // The file didn't come: go on with the game being played.
    return play(carried);
  }
  use(loaded, true);
  play(id === was.course ? carried : loaded.sessions.continueLast());
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
  current = { term, core, id: opened.id, course: course.id, readOnly: opened.readOnly };
  // This game's own store: a course loaded later must not take its saves.
  const store = sessions!;
  status("");
  startApp({
    course,
    core,
    term,
    now: Date.now,
    notice: opened.notice,
    save: opened.readOnly ? undefined : (s) => store.save(opened.id, s),
    audio,
    quit: () => {
      audio?.stop();
      status(tx("web-saved"));
    },
    settings: { courses: catalog, switchTo: (id, learner, played) => void switchTo(id, learner, played) },
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
  speed = settings.speed ?? DEFAULT_SPEED;
  try {
    catalog = await fetchJson<CatalogEntry[]>(`${base}index.json`);
    const picked = chooseStart(catalog, settings);
    if ("error" in picked) throw new Error(picked.error);
    if (!picked.ask) {
      use(await fetchCourse(picked.course, picked.learner), true);
      return play(sessions!.continueLast());
    }
    // Several courses and none chosen yet: list them, named in the first course's reading language,
    // without remembering it, since nothing has been chosen.
    use(await fetchCourse(catalog[0], learnerFor(catalog[0], settings.learner)), false);
  } catch {
    // No course text has loaded, so there is no reading language to say this in.
    status("The game could not load. Serve this page from a web server and reload.");
    return;
  }
  const labels = courseLabels(catalog, tx);
  const buttons = catalog.map((entry, i) => {
    const b = el("button", { className: "game", textContent: labels[i].replace(/^\d+\) /, "") });
    b.addEventListener("click", async () => {
      status("");
      let loaded: Loaded;
      try {
        loaded = await fetchCourse(entry, learnerFor(entry, settings.learner));
      } catch {
        status(tx("web-load-failed"));
        return; // the list stays open to try again or choose another
      }
      // Closed meanwhile, so the first course is already playing: leave it be.
      if (current) return;
      use(loaded, true);
      dialog.close();
    });
    return b;
  });
  // Closing the list without choosing plays the first course, so the page is never left empty.
  dialog.addEventListener("close", () => current || play(sessions!.continueLast()), { once: true });
  openDialog(el("h2", { textContent: tx("start-title") }), ...buttons);
}
void boot();
