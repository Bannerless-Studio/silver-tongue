import { render } from "preact";
import { createCore, mulberry32, type CatalogEntry, type Course, type GameState } from "@silver-tongue/core";
import { chooseStart, courseLabels, decodeSave, DEFAULT_SPEED, encodeSave, learnerFor, makeText, playbackRate, sessionLines, type Text } from "@silver-tongue/view";
import {
  coursesBase, createWebAudio, fetchJson, fromLocalStorage, loadWebSettings, metaContent, migrateWebAliases, updateWebSettings, WebSessions,
  type KeyValue, type Opened,
} from "@silver-tongue/web-common";
import { loadArt, type Art } from "./art";
import { App, type Page } from "./ui/App";
import { Title } from "./ui/Title";
import { createVn } from "./vn";

/** The game's version (packages/tui-node/package.json), put in by the build. */
declare const __VERSION__: string;
const root = document.getElementById("app")!;
const base = coursesBase(document);
const textUrl = metaContent(document, "st-text");

// Private windows and blocked site data make localStorage throw: play on without saving.
const noStorage: KeyValue = {
  getItem: () => { throw new Error("no storage"); },
  setItem: () => { throw new Error("no storage"); },
  removeItem: () => {},
  keys: () => [],
};
let kv = noStorage;
try {
  kv = fromLocalStorage(window.localStorage);
} catch {
  // stays noStorage
}

interface Loaded { course: Course; t: Text; sessions: WebSessions; audio: ReturnType<typeof createWebAudio>; art: Art }
let catalog: CatalogEntry[] = [];
let loaded: Loaded | undefined;
let current: { id: string; readOnly: boolean; state: () => GameState } | undefined;
/** The player's reading preferences, kept in their own settings, not in a game. */
let prefs = { speed: DEFAULT_SPEED, autoAdvance: true };

async function getText(url: string): Promise<string | null> {
  const res = await fetch(url);
  return res.ok ? res.text() : null;
}

/** Fetches a course file, its art and its sound, and moves its old games. */
async function load(entry: CatalogEntry, learner: string): Promise<Loaded> {
  const course = await fetchJson<Course>(`${base}${entry.id}/${learner}.json`);
  migrateWebAliases(kv, course);
  return {
    course,
    t: makeText(course.learnerFtl, course.learner),
    sessions: new WebSessions(kv, course, Date.now),
    audio: createWebAudio({
      base: `${base}${entry.id}/audio/`,
      audio: typeof Audio === "undefined" ? undefined : new Audio(),
      wait: (ms, cb) => {
        const h = setTimeout(cb, ms);
        return { cancel: () => clearTimeout(h) };
      },
      // Asked per clip, so a speed pressed in settings takes at once.
      rate: () => playbackRate(prefs.speed),
    }),
    art: await loadArt(`${base}${entry.id}/`, course, getText),
  };
}

function use(l: Loaded, remember: boolean) {
  loaded?.audio.stop();
  loaded = l;
  document.documentElement.lang = l.course.learner;
  if (remember) updateWebSettings(kv, { course: l.course.id, learner: l.course.learner });
}

function play(opened: Opened) {
  const l = loaded!;
  l.audio.stop();
  const core = createCore(l.course, opened.state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
  const store = l.sessions; // this game's own store: a course loaded later must not take its saves
  const vn = createVn({
    course: l.course, core, now: Date.now, audio: l.audio, notice: opened.notice,
    autoAdvance: prefs.autoAdvance,
    save: opened.readOnly ? undefined : (s) => store.save(opened.id, s),
  });
  current = { id: opened.id, readOnly: opened.readOnly, state: () => core.state };
  const page: Page = {
    catalog,
    audioAvailable: l.audio.available,
    // A getter, because this page is built once per game and the preferences outlive it: a plain
    // property here would freeze the row's seed at the values the game started with.
    get prefs() { return prefs; },
    setPref: (patch) => {
      prefs = { ...prefs, ...patch };
      updateWebSettings(kv, patch);
    },
    switchTo: (id, learner) => void switchTo(id, learner),
    textUrl,
    games: {
      list: () => {
        const list = store.list();
        const lines = sessionLines(list, l.course, l.t, (ms) => new Date(ms).toLocaleString());
        return list.map((s, i) => ({ id: s.id, label: lines[i].replace(/^\d+\) /, "") }));
      },
      open: (id) => play(store.open(id)),
      startNew: () => play(store.startNew()),
      exportLine: () => encodeSave(core.state),
      importLine: async (line) => {
        const decoded = await decodeSave(line, l.course);
        if (!decoded.ok) return l.t("import-bad", { reason: decoded.reason });
        const id = store.add(decoded.state);
        if (!id) return l.t("notice-read-only");
        play(store.open(id));
        return null;
      },
    },
  };
  render(<App key={`${l.course.id}/${l.course.learner}/${opened.id}`} vn={vn} art={l.art} page={page} />, root);
}

/** Another course or reading language, chosen in settings. */
async function switchTo(id: string, learner: string) {
  const entry = catalog.find((e) => e.id === id);
  const was = current!;
  const carried: Opened = { id: was.id, state: was.state(), readOnly: was.readOnly };
  const sameCourse = id === loaded!.course.id;
  try {
    if (!entry) throw new Error(`no course ${id}`);
    use(await load(entry, learner), true);
  } catch {
    return play(carried); // the file didn't come: go on with the game being played
  }
  // Another reading language goes on with the game as played, saved or not.
  play(sameCourse ? carried : loaded!.sessions.continueLast());
}

function title(courses?: { label: string; pick: () => void }[], error?: string) {
  const l = loaded;
  const t = l?.t ?? Object.assign((id: string) => id, { has: () => false });
  render(
    <Title
      t={t} version={__VERSION__} courses={courses} error={error} hasSave={!!l && l.sessions.list().length > 0}
      onContinue={() => play(l!.sessions.continueLast())} onNew={() => play(l!.sessions.startNew())}
    />,
    root,
  );
}

async function boot() {
  const settings = loadWebSettings(kv);
  prefs = { speed: settings.speed ?? DEFAULT_SPEED, autoAdvance: settings.autoAdvance ?? true };
  try {
    catalog = await fetchJson<CatalogEntry[]>(`${base}index.json`);
    const picked = chooseStart(catalog, settings);
    if ("error" in picked) throw new Error(picked.error);
    if (!picked.ask) {
      use(await load(picked.course, picked.learner), true);
      return title();
    }
    // Several courses and none chosen yet: list them, named in the first course's reading language.
    use(await load(catalog[0], learnerFor(catalog[0], settings.learner)), false);
  } catch {
    // No course text has loaded, so there is no reading language to say this in.
    return title(undefined, "The game could not load. Serve this page from a web server and reload.");
  }
  const labels = courseLabels(catalog, loaded!.t);
  title(
    catalog.map((entry, i) => ({
      label: labels[i].replace(/^\d+\) /, ""),
      pick: async () => {
        try {
          use(await load(entry, learnerFor(entry, settings.learner)), true);
          title();
        } catch {
          title(undefined, loaded!.t("web-load-failed"));
        }
      },
    })),
  );
}
void boot();
