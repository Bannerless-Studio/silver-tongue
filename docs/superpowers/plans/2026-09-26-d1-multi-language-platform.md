# D1: multi-language platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Silver Tongue holds many courses and reading languages, lets the player switch between them from a settings screen, and keeps every language-specific behaviour in content and configuration; Chinese plays exactly as before.

**Architecture:** The build turns each `content/courses/<id>.json` into one `Course` file per reading language plus a catalog (`dist/courses/index.json`). Each `Course` carries a `LanguageProfile` (spaced or not, locales) and its reading language; the core and the shared app read only those fields. The front ends own choosing, remembering and switching: they read the catalog and the player's settings, and restart the app on another course or reading language when the app's new `[o]` settings screen asks them to.

**Tech Stack:** TypeScript (ESM, Node ≥ 22), Vitest, Fluent (`@fluent/bundle`), esbuild, xterm.js.

**Spec:** `docs/superpowers/specs/2026-09-26-d1-multi-language-platform-design.md`

## Global Constraints

- The core stays free of I/O and rendering; front ends talk to it only through `send` and `state`. `Input` and `GameEvent` only grow.
- Course id `zh-china` (was `zh-china-en`); config `content/courses/zh-china.json` with `"learners": ["en"]`, `"aliases": ["zh-china-en"]`.
- Build output: `dist/courses/<course>/<learner>.json` and `dist/courses/index.json`. A failure in any course fails the build; each error line names the course and reading language.
- Tiles join with `" "` when `course.language.spaced`, `""` otherwise.
- `Word.readings?: string[]` replaces `Word.pron`; the build writes `readings: w.readings ?? (w.pron ? [w.pron] : undefined)`.
- Reading-language text is formatted with `course.learner` as the locale; `makeText` has no default locale.
- A spaced language and `"direction": "rtl"` are refused by the build with a clear error.
- No Han, kana or Hangul character and no language-code comparison in `packages/*/src` outside `packages/core/src/testing/`.
- Player settings: `<config>/silver-tongue/settings.json` (terminal, atomic write), `localStorage["silver-tongue:settings"]` (browser). Unreadable or unknown values are ignored, never fatal.
- Every UI string the TUI uses is listed in `packages/tui/src/text.ts` `UI_KEYS`.
- Every release adds a `CHANGELOG.md` entry before the `release:` commit.
- Chinese plays unchanged: the build has no errors and `npm run bots` prints the same numbers as 0.12.2.
- The repository is now `https://github.com/Bannerless-Studio/silver-tongue`, the page `https://bannerless-studio.github.io/silver-tongue/`.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4
  ```
  and `git add` names explicit paths only.

## Review Focus

1. **A player with a 0.12 save upgrades.** `~/.config/silver-tongue/sessions/zh-china-en/*.json` (and a pre-sessions `silver-tongue/zh-china-en.json`) must all appear under `zh-china` with their times kept; nothing is lost when both folders already exist (Task 7 test "moves every alias file, renaming clashes").
2. **A browser player with 0.12 saves.** `silver-tongue:zh-china-en:session:*`, `…:meta` and backups move to `silver-tongue:zh-china:` and the last-played game still opens first (Task 8 test "moves alias keys and keeps the last game").
3. **A settings file or `localStorage` value that is garbage, names a course no longer in the catalog, or a reading language the course doesn't support** starts the game normally on a sensible default (Task 6 tests "ignores unknown course", "falls back to the course's first reading language").
4. **Switching course or reading language mid-scene** saves first and resumes the same scene after a reading-language switch (Task 5 test "saves before switching"; Task 10 play-test).
5. **`--learn` naming nothing in the catalog** exits with a clear message and code 2 instead of a stack trace (Task 7 test "unknown --learn").

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `packages/core/src/types.ts` | modify | `LanguageProfile`, `CatalogEntry`, `Course.learner/language/aliases`, `Word.readings` |
| `packages/core/src/dialogue.ts` | modify | `joinTiles`; `replyTiles` uses it |
| `packages/core/src/save.ts` | modify | aliases accepted |
| `packages/core/src/testing/fixture.ts` | modify | new fields; `spacedCourse()` |
| `tools/src/pack.ts` | modify | `PackMeta.direction`, `PackWord.readings` |
| `tools/src/build-course.ts` | modify | per-learner build, profile, names check, rtl, `buildAll`, catalog output |
| `tools/src/audio.ts`, `tools/src/bots.ts` | modify | new ids and paths |
| `tools/test/language-free.test.ts` | create | the guard |
| `content/courses/zh-china.json` | rename from `zh-china-en.json` | course config |
| `content/learner/en/ui.ftl` | modify | names, settings screen, start list |
| `packages/tui/src/text.ts` | modify | `makeText(ftl, locale)`; new `UI_KEYS` |
| `packages/tui/src/app.ts` | modify | locale, readings, spaced joins, settings screen |
| `packages/tui/src/notebook.ts` | modify | readings |
| `packages/tui/src/choose.ts` | create | `PlayerSettings`, `parseSettings`, `chooseStart`, `courseLabels` |
| `packages/tui-node/src/cli.ts` | modify | `--learn`, `--read` |
| `packages/tui-node/src/storage.ts` | modify | `writeFileAtomic`; settings load/save |
| `packages/tui-node/src/sessions.ts` | modify | `migrateCourseSessions` |
| `packages/tui-node/src/catalog.ts` | create | find catalog, course files, clip folder |
| `packages/tui-node/src/main.ts` | rewrite | start, ask, switch |
| `packages/tui-node/bundle-courses.mjs` | create | copy catalog, courses, clips into the bundle |
| `packages/tui-web/build.mjs` | modify | no inlined course; copy catalog and clips |
| `packages/tui-web/src/web-storage.ts` | modify | `migrateWebAliases`, `loadWebSettings`, `saveWebSettings` |
| `packages/tui-web/src/main.ts` | modify | fetch, start dialog, switching |
| `packages/tui-web/src/index.html` | modify | no `lang`, `o` key |
| `CHANGELOG.md` | create | every release |
| `CLAUDE.md`, READMEs, `LICENSE`s, `packages/tui-node/package.json` | modify | new repo, rules, commands |

---

### Task 1: Repository move, changelog and baseline

**Files:**
- Create: `CHANGELOG.md`
- Modify: `CLAUDE.md`, `README.md`, `packages/tui-node/README.md`, `packages/tui-node/package.json:6`, `packages/tui-web/src/index.html:22`

**Interfaces:**
- Consumes: nothing.
- Produces: the bots baseline file `.superpowers/sdd/2026-09-26-d1-multi-language-platform/bots-0.12.2.txt` that Task 10 compares against.

- [ ] **Step 1: Branch and record the bots baseline (before any code changes)**

```bash
git checkout -b d1-multi-language
npm run build:course
npm run bots > .superpowers/sdd/2026-09-26-d1-multi-language-platform/bots-0.12.2.txt
```

Expected: the build prints `built zh-china-en: 35 scenes …`; the baseline file has one block per bot.

- [ ] **Step 2: Point every link at the new repository**

- `packages/tui-node/package.json` `repository.url` → `git+https://github.com/Bannerless-Studio/silver-tongue.git` (npm provenance checks it against the workflow's repository).
- `packages/tui-web/src/index.html` `#github` `href` → `https://github.com/Bannerless-Studio/silver-tongue`.
- `README.md:11`, `packages/tui-node/README.md:11` → `https://bannerless-studio.github.io/silver-tongue/`; `packages/tui-node/README.md:35` → `https://github.com/Bannerless-Studio/silver-tongue`.
- Leave `LICENSE` copyright holders and old specs/plans unchanged (history).

Run: `grep -rn "jamil314" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=vendor --exclude-dir=docs . | grep -v LICENSE`
Expected: no output.

- [ ] **Step 3: Write `CHANGELOG.md`**

```markdown
# Changelog

Every release of Silver Tongue, newest first.

## 0.12.2 (2026-09-26)

- A right tiles answer is shown as the whole reply, punctuation and all.
- The silence around each spoken clip is trimmed, so lines follow each other without long pauses.

## 0.12.1 (2026-09-26)

- Word help can say the whole sentence too ([s]), and [p] says it again.

## 0.12.0 (2026-09-26)

- Sound: people speak their lines and you hear your own reply, in the terminal (ffplay, mpv, mpg123 or afplay) and in the browser.
- Each character has their own voice; a line with your name pauses where your name goes.
- [r] hears a line again, [m] turns sound on or off, [p] says a word you looked up.

## 0.11.1 (2026-09-26)

- Jobs pay ¥10 a turn (¥20 a delivery), so a player who gets most replies right can keep up with the rent.

## 0.11.0 (2026-09-26)

- All 150 HSK 1 words: Old Chen's tea house, your neighbour Mrs Lin and her family, a Chinese class with David, Old Ma's taxi stand, Mr Li on the phone, the doctor and the lunch rush.
- Full pay only when you get a reply right the first time.

## 0.10.0 (2026-09-26)

- Wash dishes for the cook, then haggle over apples at the corner shop and buy things with your own money.

## 0.9.0 (2026-09-26)

- Deliveries: Miss Gao hands you a parcel and names the place; walk it to the school, the hospital or the train station.

## 0.8.0 (2026-09-25)

- The warehouse: Big Liu counts you to ten and gives you work; Mr Li tells you the rent.

## 0.7.0 (2026-09-25)

- Your room and the landlord; you sleep only at home.
- Counting with Old Wang before work.
- Your name is a reply tile.

## 0.6.2 (2026-09-25)

- A link to the source on GitHub; on phones the keyboard opens only when you type your name.

## 0.6.1 (2026-09-25)

- Phone keyboards can type your name.

## 0.6.0 (2026-09-25)

- The game asks your name and people use it; the version shows in the bottom border.

## 0.5.0 (2026-09-25)

- A real first conversation with Old Wang, and wrong answers you can read.

## 0.4.1 (2026-09-25)

- Tile replies are explained the first time, and you can back out of them.

## 0.4.0 (2026-09-25)

- What your replies do is told as a story; a notebook of the words you have met; a mentor who explains usage; export and import of games.
- The game in the browser, playable on a phone.

## 0.3.1 (2026-09-25)

- A fix to the greetings lesson, and small polish.

## 0.3.0 (2026-09-25)

- Several games side by side: `--new` starts another, `--resume` picks one.

## 0.2.0 (2026-09-25)

- A story to start with, greetings first, and the English meaning of every line.

## 0.1.1 (2026-09-25)

- A clearer reply prompt.

## 0.1.0 (2026-09-25)

- The first terminal demo, playable with `npx silver-tongue`.
```

- [ ] **Step 4: Add the changelog rule to `CLAUDE.md`**

Under `## Rules` append:

```markdown
- Every release adds its `CHANGELOG.md` entry (newest first, `## <version> (<date>)`, plain words for players) before the `release:` commit.
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md CLAUDE.md README.md packages/tui-node/README.md packages/tui-node/package.json packages/tui-web/src/index.html
git commit -m "docs: changelog for every release; links follow the move to Bannerless-Studio"
```

---

### Task 2: Core — language profile, readings, spaced tiles, aliases

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/dialogue.ts:54-58,335-350`, `packages/core/src/save.ts:86`, `packages/core/src/index.ts`, `packages/core/src/testing/fixture.ts`
- Test: `packages/core/test/core.test.ts`, `packages/core/test/save.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LanguageProfile { code: string; locale: string; tts: string; spaced: boolean }
  export interface CatalogEntry {
    id: string; language: string; setting: string; learners: string[];
    /** reading language code -> its own name ("English"), from that language's `learner-name` */
    learnerNames: Record<string, string>;
  }
  // Course gains: learner: string; language: LanguageProfile; aliases?: string[]
  // Word: readings?: string[]   (pron removed)
  export function joinTiles(course: Course, pieces: string[]): string
  // testing: spacedCourse(learner?: string): Course   (id "xx-town", spaced, two readings per word)
  ```

- [ ] **Step 1: Write the failing tests**

In `packages/core/test/core.test.ts` add (import `spacedCourse` from `../src/testing/fixture` and `joinTiles` from `../src/dialogue`):

```ts
describe("spaced languages", () => {
  it("joins tiles with a space only when the language is spaced", () => {
    expect(joinTiles(fixtureCourse(), ["a", "b"])).toBe("ab");
    expect(joinTiles(spacedCourse(), ["a", "b"])).toBe("a b");
  });

  it("accepts the right tiles in a spaced language", () => {
    const course = spacedCourse();
    const core = createCore(course, newGame(course), { now: () => 0, rng: mulberry32(1) });
    core.send({ type: "goTo", place: "noodle_shop" });
    core.send({ type: "startScene", scene: "intro" });
    // greet is pick mode on first meeting: answer it, then the tiles exchange follows once words are met
    const run = core.state.run!;
    const reply = course.scenes[0].exchanges[0].variants[""].reply;
    expect(reply.text).toBe("mi bon!");
    const order = tilePieces(reply).map((p) => run.tiles.indexOf(p));
    if (run.mode === "tiles") {
      const ev = core.send({ type: "replyTiles", tiles: order });
      expect(ev.find((e) => e.type === "actionPerformed")).toMatchObject({ tilesWrong: false });
    }
  });
});
```

Replace the second test with a deterministic one if the first exchange is pick mode: set the mode by putting the greet words in `state.words` as known first. Use this exact version:

```ts
  it("accepts the right tiles in a spaced language", () => {
    const course = spacedCourse();
    const state = newGame(course);
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
    for (const id of Object.keys(course.words)) state.words[id] = { ...known };
    state.place = "noodle_shop";
    const core = createCore(course, state, { now: () => 0, rng: mulberry32(1) });
    core.send({ type: "startScene", scene: "intro" });
    const run = core.state.run!;
    expect(run.mode).toBe("tiles");
    const reply = course.scenes[0].exchanges[0].variants[""].reply;
    const used = new Set<number>();
    const order = tilePieces(reply).map((p) => {
      const i = run.tiles.findIndex((x, j) => x === p && !used.has(j));
      used.add(i);
      return i;
    });
    const ev = core.send({ type: "replyTiles", tiles: order });
    expect(ev.find((e) => e.type === "actionPerformed")).toMatchObject({ tilesWrong: false });
  });
```

If `run.mode` is not `"tiles"` with every word known, read `chooseMode` in `packages/core/src/dialogue.ts` and set the state it needs; ledger the change.

In `packages/core/test/save.test.ts` add:

```ts
  it("loads a save made under an alias as the course's own id", () => {
    const course = { ...fixtureCourse(), aliases: ["old-id"] };
    const state = { ...newGame(course), course: "old-id" };
    const r = parseSave(serialize(state), course);
    expect(r).toEqual({ ok: true, state: { ...state, course: course.id } });
  });

  it("still refuses another course's save", () => {
    const course = { ...fixtureCourse(), aliases: ["old-id"] };
    expect(parseSave(serialize({ ...newGame(course), course: "other" }), course)).toEqual({ ok: false, reason: "other-course" });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/core`
Expected: FAIL — `joinTiles`/`spacedCourse` are not exported; the alias test gets `other-course`.

- [ ] **Step 3: Types**

In `packages/core/src/types.ts`:

```ts
/** What the engine needs to know about the language being learned. */
export interface LanguageProfile {
  /** the language pack's code */
  code: string;
  /** Fluent/Intl locale for lines in this language */
  locale: string;
  /** speech locale */
  tts: string;
  /** true when words are written with spaces between them */
  spaced: boolean;
}

/** One course in dist/courses/index.json. */
export interface CatalogEntry {
  id: string;
  language: string;
  setting: string;
  /** reading languages, the default first */
  learners: string[];
  /** reading language code -> its own name, from its `learner-name` */
  learnerNames: Record<string, string>;
}
```

`Word`: replace `pron?: string;` with

```ts
  /** how to say it, most native first; the last is the one sentence help shows */
  readings?: string[];
```

`Course`: after `id` add

```ts
  /** the reading language this file was built for */
  learner: string;
  language: LanguageProfile;
  /** earlier ids of this course, whose saves it still loads */
  aliases?: string[];
```

- [ ] **Step 4: `joinTiles`, `replyTiles`, exports**

In `packages/core/src/dialogue.ts` after `tilePieces`:

```ts
/** Tiles as the player reads them: with spaces between them in a spaced language. */
export function joinTiles(course: Course, pieces: string[]): string {
  return pieces.join(course.language.spaced ? " " : "");
}
```

In `replyTiles` replace the `shown` line with:

```ts
  const shown = (pieces: string[]) => joinTiles(ctx.course, pieces.map((x) => (x === PLAYER_MARK ? name : x)));
```

Fix the comment at `dialogue.ts:244` so it quotes no content word: `// The reply's own words count too: saying them right is how a player learns a set phrase.`

`packages/core/src/index.ts`: `export { describeRun, joinTiles, tilePieces } from "./dialogue";`

- [ ] **Step 5: Aliases in `parseSave`**

Replace `save.ts:86` with:

```ts
  if (data.course !== course.id && !(course.aliases ?? []).includes(data.course as string)) return { ok: false, reason: "other-course" };
  data.course = course.id; // a save made under an old id is saved under the new one from now on
```

- [ ] **Step 6: Fixtures**

In `fixture.ts`: the word table's third entry becomes readings. Change `W` to `Record<string, [string, string, string[]?]>`, `w_ni: ["你", "you", ["nǐ"]]`, `w_hao: ["好", "good", ["hǎo"]]`, and the words map to `...(readings ? { readings } : {})`. In the course object add `learner: "en"`, `language: { code: "zh", locale: "zh", tts: "zh-CN", spaced: false }` after `id`.

Add after `fixtureCourse`:

```ts
/** A made-up spaced language for the same two scenes: every word has a native and a plain reading. */
const SPACED: Record<string, [string, string[]]> = {
  w_ni: ["mi", ["mí", "mi"]],
  w_hao: ["bon", ["bón", "bon"]],
  w_cha: ["te", ["té", "te"]],
  w_shui: ["akva", ["ákva", "akva"]],
  w_san: ["tri", ["trí", "tri"]],
  w_si: ["kvar", ["kvár", "kvar"]],
  x_bei: ["tas", ["tás", "tas"]],
  w_bu: ["ne", ["né", "ne"]],
  w_shi: ["estas", ["éstas", "estas"]],
  w_zhe: ["ci", ["cí", "ci"]],
  w_ge: ["unu", ["únu", "unu"]],
};
const PUNCT: Record<string, string> = { "，": ",", "。": ".", "！": "!", "？": "?" };

/** The same line in the spaced language: words swapped, a space before every word but the first. */
function respace(l: RenderedLine): RenderedLine {
  const parts: [string, string | null][] = [];
  let at = 0;
  for (const tk of l.tokens) {
    const gap = [...l.text.slice(at, tk.start)].map((c) => PUNCT[c] ?? c).join("");
    if (gap) parts.push([gap, null]);
    if (parts.length) parts.push([" ", null]);
    parts.push([SPACED[tk.word][0], tk.word]);
    at = tk.end;
  }
  const tail = [...l.text.slice(at)].map((c) => PUNCT[c] ?? c).join("");
  if (tail) parts.push([tail, null]);
  return { ...l, ...line(...parts) };
}

/** The fixture course in a made-up spaced language, read in `learner`. */
export function spacedCourse(learner = "en"): Course {
  const c = fixtureCourse();
  c.id = "xx-town";
  c.learner = learner;
  c.language = { code: "xx", locale: "en", tts: "en-US", spaced: true };
  for (const [id, word] of Object.entries(c.words)) {
    word.w = SPACED[id][0];
    word.readings = SPACED[id][1];
  }
  for (const s of c.scenes)
    for (const ex of s.exchanges)
      for (const v of Object.values(ex.variants)) {
        v.npc = respace(v.npc);
        v.reply = respace(v.reply);
        if (v.rephrase) v.rephrase = respace(v.rephrase);
        if (v.alts) v.alts = v.alts.map(respace);
      }
  for (const [id, l] of Object.entries(c.reactions)) c.reactions[id] = respace(l);
  return c;
}
```

`respace` keeps `meaning` and `audio` (spread first, then the new `text`/`tokens`). Import `RenderedLine` is already imported.

- [ ] **Step 7: Fix every other compile error from the type change**

Run: `npm run typecheck 2>&1 | head -40`
Expected errors: `pron` in `packages/tui/src/app.ts`, `packages/tui/src/notebook.ts`, `tools/src/build-course.ts`; missing `learner`/`language` where a `Course` literal is built in tests. Leave `app.ts`, `notebook.ts` and `build-course.ts` for Tasks 3–4 but make them compile now with the smallest change: replace `w.pron` by `w.readings?.join(" ")` in `app.ts:444` and `notebook.ts:43`, `course.words[tk.word]?.pron` by `course.words[tk.word]?.readings?.at(-1)` in `app.ts:458`, and in `build-course.ts:111` write `...(w.pron ? { readings: [w.pron] } : {})`, and add `learner: cfg.learner, language: { code: meta.key, locale: meta.locale, tts: meta.tts, spaced: meta.spaced },` to the course literal. Test files that build a `Course` literal get the same two fields.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run packages/core`
Expected: PASS, including the three new tests.

Run: `npm test > .superpowers/sdd/2026-09-26-d1-multi-language-platform/t2.txt 2>&1; tail -5 .superpowers/sdd/2026-09-26-d1-multi-language-platform/t2.txt`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/core tools/src/build-course.ts packages/tui/src/app.ts packages/tui/src/notebook.ts
git add $(git diff --name-only -- packages/tui/test tools/test)
git commit -m "core: a course carries its language profile; spaced tiles, several readings, old ids load"
```

---

### Task 3: Build — per-reading-language courses and the catalog

**Files:**
- Rename: `content/courses/zh-china-en.json` → `content/courses/zh-china.json`
- Modify: `tools/src/pack.ts`, `tools/src/build-course.ts`, `tools/src/audio.ts:59-61`, `tools/src/bots.ts:258-262`, `content/learner/en/ui.ftl`, `CLAUDE.md` (commands)
- Test: `tools/test/build-course.test.ts`, `tools/test/bots.test.ts`

**Interfaces:**
- Consumes: `LanguageProfile`, `CatalogEntry`, `Course.learner/language/aliases` (Task 2).
- Produces:
  ```ts
  export interface CourseConfig { id: string; language: string; setting: string; learners: string[]; aliases?: string[]; checks: { coverage: boolean; audio: boolean } }
  export function buildCourse(root: string, courseId: string, learner?: string): BuildResult
  export interface BuiltCourses { catalog: CatalogEntry[]; builds: { course: string; learner: string; result: BuildResult }[]; errors: string[] }
  export function buildAll(root: string, only?: string): BuiltCourses
  export function courseIds(root: string): string[]
  ```
  Output files `dist/courses/<id>/<learner>.json`, `dist/courses/index.json`. `bots` reads `dist/courses/<id>/<learner>.json` (defaults `zh-china`, its first learner).

- [ ] **Step 1: Rename the config and write its new shape**

```bash
git mv content/courses/zh-china-en.json content/courses/zh-china.json
```

Contents:

```json
{
  "id": "zh-china",
  "language": "zh",
  "setting": "china-city",
  "learners": ["en"],
  "aliases": ["zh-china-en"],
  "checks": { "coverage": true, "audio": true }
}
```

- [ ] **Step 2: Write the failing tests**

In `tools/test/build-course.test.ts`: change every `"zh-china-en"` to `"zh-china"` (including `courses/zh-china-en.json` paths and the test name), then add:

```ts
describe("courses and the catalog", () => {
  it("builds the course for its reading language with its profile and old ids", () => {
    const { course } = buildCourse(CONTENT, "zh-china");
    expect(course!.id).toBe("zh-china");
    expect(course!.learner).toBe("en");
    expect(course!.language).toEqual({ code: "zh", locale: "zh", tts: "zh-CN", spaced: false });
    expect(course!.aliases).toEqual(["zh-china-en"]);
    expect(Object.values(course!.words).find((w) => w.w === "你")!.readings).toEqual(["nǐ"]);
  });

  it("lists every course and its reading languages by name", () => {
    const { catalog, errors } = buildAll(CONTENT);
    expect(errors).toEqual([]);
    expect(catalog).toEqual([{ id: "zh-china", language: "zh", setting: "china-city", learners: ["en"], learnerNames: { en: "English" } }]);
  });

  it("builds one file per reading language and names the course and reading language in errors", () => {
    const dir = copyContent((d) => {
      cpSync(join(d, "learner/en"), join(d, "learner/fr"), { recursive: true });
      const cfgPath = join(d, "courses/zh-china.json");
      writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, "utf8")), learners: ["en", "fr"] }));
      writeFileSync(join(d, "learner/fr/ui.ftl"), readFileSync(join(d, "learner/fr/ui.ftl"), "utf8").replace(/^learner-name = .*$/m, ""));
    });
    const { builds, errors } = buildAll(dir);
    expect(builds.map((b) => [b.course, b.learner])).toEqual([["zh-china", "en"], ["zh-china", "fr"]]);
    expect(builds[1].result.course!.learner).toBe("fr");
    expect(errors).toEqual(['zh-china/fr: learner/fr/ui.ftl: missing "learner-name"']);
  });

  it("fails a reading language that can't name the language", () => {
    const { errors } = buildChanged((d) => {
      const p = join(d, "learner/en/ui.ftl");
      writeFileSync(p, readFileSync(p, "utf8").replace(/^language-zh = .*$/m, ""));
    });
    expect(errors).toContain('learner/en/ui.ftl: missing "language-zh"');
  });

  it("refuses a right-to-left language", () => {
    const { course, errors } = buildChanged((d) => {
      const p = join(d, "languages/zh/pack.json");
      writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, "utf8")), direction: "rtl" }));
    });
    expect(course).toBeUndefined();
    expect(errors).toEqual(['language "zh" is written right to left; no front end can show that yet']);
  });

  it("refuses a reading language the course doesn't list", () => {
    expect(buildCourse(CONTENT, "zh-china", "fr").errors).toEqual(['courses/zh-china.json: "fr" is not in learners']);
  });

  it("refuses a config whose id isn't its file name", () => {
    const { errors } = buildChanged((d) => {
      const p = join(d, "courses/zh-china.json");
      writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, "utf8")), id: "other" }));
    });
    expect(errors).toEqual(['courses/zh-china.json: id "other" must match the file name']);
  });

  it("prefers a word's own readings to its pack pronunciation", () => {
    const { course } = buildChanged((d) => {
      const p = join(d, "languages/zh/words.json");
      const words = JSON.parse(readFileSync(p, "utf8")) as { w: string; readings?: string[] }[];
      words.find((w) => w.w === "你")!.readings = ["nǐ", "ni"];
      writeFileSync(p, JSON.stringify(words));
    });
    expect(Object.values(course!.words).find((w) => w.w === "你")!.readings).toEqual(["nǐ", "ni"]);
  });
});
```

Split the existing `buildChanged` helper so the copy is reusable:

```ts
/** A copy of the real content after `change` edits it. */
function copyContent(change: (dir: string) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "st-content-"));
  temps.push(dir);
  // The clips are ~10 MB: link them instead of copying them for every test.
  const audio = join(CONTENT, "audio");
  cpSync(CONTENT, dir, { recursive: true, filter: (src) => src !== audio });
  if (existsSync(audio)) symlinkSync(audio, join(dir, "audio"));
  change(dir);
  return dir;
}

/** Builds a copy of the real content after `change` edits it. */
function buildChanged(change: (dir: string) => void) {
  return buildCourse(copyContent(change), "zh-china");
}
```

Import `buildAll` from `../src/build-course`. In `tools/test/bots.test.ts` change `"zh-china-en"` to `"zh-china"`.

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tools/test/build-course.test.ts`
Expected: FAIL — `buildAll` is not exported, `learners` is ignored, no names check, no rtl check.

- [ ] **Step 4: Pack types**

In `tools/src/pack.ts` `PackMeta` add:

```ts
  /** "rtl" for a right-to-left script; absent means left to right */
  direction?: "ltr" | "rtl";
```

and in both word interfaces that have `pron?: string;` add below it:

```ts
  /** readings, most native first; overrides pron */
  readings?: string[];
```

- [ ] **Step 5: `buildCourse` per reading language**

In `tools/src/build-course.ts`:

- Export `CourseConfig` with `learners: string[]; aliases?: string[]` in place of `learner: string`.
- Signature `export function buildCourse(root: string, courseId: string, learnerCode?: string): BuildResult`.
- After reading `cfg`:

```ts
  if (cfg.id !== courseId) {
    errors.push(`courses/${courseId}.json: id "${cfg.id}" must match the file name`);
    return stop();
  }
  const learner = learnerCode ?? cfg.learners[0];
  if (!cfg.learners.includes(learner)) {
    errors.push(`courses/${courseId}.json: "${learner}" is not in learners`);
    return stop();
  }
```

  Replace every later `cfg.learner` with `learner`.
- After the `meta.spaced` check:

```ts
  if (meta.direction === "rtl") {
    errors.push(`language "${meta.key}" is written right to left; no front end can show that yet`);
    return stop();
  }
```

- Word entry: `...((w.readings ?? (w.pron ? [w.pron] : undefined)) ? { readings: w.readings ?? [w.pron!] } : {}),`
- Course literal: `id: cfg.id, learner, language: { code: meta.key, locale: meta.locale, tts: meta.tts, spaced: meta.spaced }, ...(cfg.aliases?.length ? { aliases: cfg.aliases } : {}),`
- After `learnerIds` is computed:

```ts
  for (const id of ["learner-name", `language-${cfg.language}`]) {
    if (!learnerIds.has(id)) errors.push(`learner/${learner}/ui.ftl: missing "${id}"`);
  }
```

- [ ] **Step 6: `buildAll`, `courseIds` and `main`**

```ts
/** Course ids: the config files in content/courses. */
export function courseIds(root: string): string[] {
  const dir = join(root, "courses");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length)).sort();
}

export interface BuiltCourses {
  catalog: CatalogEntry[];
  builds: { course: string; learner: string; result: BuildResult }[];
  /** every build's errors, each prefixed "<course>/<learner>: " */
  errors: string[];
}

/** Builds every course (or only `only`) for each of its reading languages. */
export function buildAll(root: string, only?: string): BuiltCourses {
  const out: BuiltCourses = { catalog: [], builds: [], errors: [] };
  for (const id of only ? [only] : courseIds(root)) {
    let cfg: CourseConfig;
    try {
      cfg = readJson<CourseConfig>(join(root, "courses", `${id}.json`));
    } catch (e) {
      out.errors.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    const learnerNames: Record<string, string> = {};
    for (const learner of cfg.learners ?? []) {
      const result = buildCourse(root, id, learner);
      out.builds.push({ course: id, learner, result });
      out.errors.push(...result.errors.map((e) => `${id}/${learner}: ${e}`));
      const name = result.course && makeName(result.course.learnerFtl, learner);
      if (name) learnerNames[learner] = name;
    }
    out.catalog.push({ id: cfg.id, language: cfg.language, setting: cfg.setting, learners: cfg.learners, learnerNames });
  }
  return out;
}

/** A reading language's own name, from its learner-name message. */
function makeName(ftl: string, locale: string): string | undefined {
  try {
    return new Renderer(locale, [["learner", ftl]]).render("learner-name");
  } catch {
    return undefined;
  }
}
```

Adjust the test in Step 2 if the error prefix for the missing `learner-name` shows as `zh-china/fr: learner/fr/ui.ftl: missing "learner-name"` — that is the expected form. If `Renderer` rejects a whole learner FTL for a reason unrelated to `learner-name`, fall back to `makeText(ftl, locale)` from `@silver-tongue/tui` and `t.has("learner-name") ? t("learner-name") : undefined`; ledger it.

`main`:

```ts
function main(): void {
  const only = process.argv[2];
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { catalog, builds, errors } = buildAll(join(repo, "content"), only);
  if (errors.length || builds.some((b) => !b.result.course)) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`${errors.length} error(s); nothing written`);
    process.exit(1);
  }
  const out = join(repo, "dist", "courses");
  // A full build replaces dist/courses, so a renamed course leaves nothing stale behind.
  if (!only) rmSync(out, { recursive: true, force: true });
  for (const { course, learner, result } of builds) {
    mkdirSync(join(out, course), { recursive: true });
    writeFileSync(join(out, course, `${learner}.json`), JSON.stringify(result.course));
    console.log(`built ${course}/${learner}: ${result.course!.scenes.length} scenes`);
  }
  const index = join(out, "index.json");
  const previous: CatalogEntry[] = only && existsSync(index) ? JSON.parse(readFileSync(index, "utf8")) : [];
  const merged = [...previous.filter((e) => !catalog.some((c) => c.id === e.id)), ...catalog].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(index, JSON.stringify(merged, null, 2));
  console.log(`catalog: ${merged.map((e) => e.id).join(", ")} -> ${index}`);
}
```

Add `rmSync` to the `node:fs` import and `type CatalogEntry` to the core import.

- [ ] **Step 7: Names in the English UI text**

Append to `content/learner/en/ui.ftl`:

```ftl
## Languages, by code, for the settings screen and the start list
learner-name = English
language-zh = Chinese
```

- [ ] **Step 8: `audio.ts` and `bots.ts`**

`tools/src/audio.ts` `main`: default `"zh-china"` in place of `"zh-china-en"`. Clips do not depend on the reading language: build with `buildCourse(content, courseId)` (its first learner) as now. Add at the top of `main`, when no id is given, a loop over `courseIds(content)`, grouped by language so unused-clip deletion sees every course of that language:

```ts
  const content = join(repo, "content");
  const given = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const ids = given ? [given] : courseIds(content);
  const byDir = new Map<string, Clip[]>();
  for (const id of ids) {
    const { course, errors, clips, audioDir } = buildCourse(content, id);
    const other = errors.filter((e) => !e.startsWith("audio: no file for clip "));
    if (!course || !audioDir || other.length) {
      for (const e of other) console.error(`✗ ${id}: ${e}`);
      process.exit(1);
    }
    const seen = new Set((byDir.get(audioDir) ?? []).map((c) => c.id));
    byDir.set(audioDir, [...(byDir.get(audioDir) ?? []), ...clips.filter((c) => !seen.has(c.id))]);
  }
  for (const [audioDir, clips] of byDir) makeClips(audioDir, clips);
```

and move the rest of today's `main` body (from `mkdirSync(audioDir…` to the failure exit) into `function makeClips(audioDir: string, clips: Clip[]): void`, unchanged apart from reading `retrim` inside it.

`tools/src/bots.ts` `main`:

```ts
  const courseId = process.argv[2] ?? "zh-china";
  const days = Number(process.argv[3] ?? 14);
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const catalog = JSON.parse(readFileSync(join(repo, "dist", "courses", "index.json"), "utf8")) as CatalogEntry[];
  const learner = catalog.find((e) => e.id === courseId)?.learners[0] ?? "en";
  const course = JSON.parse(readFileSync(join(repo, "dist", "courses", courseId, `${learner}.json`), "utf8")) as Course;
```

- [ ] **Step 9: Run the tests and the build**

Run: `npx vitest run tools`
Expected: PASS.

Run: `npm run build:course && ls dist/courses dist/courses/zh-china && cat dist/courses/index.json`
Expected: `index.json  zh-china`, `en.json`, and the catalog entry with `"learnerNames": { "en": "English" }`.

- [ ] **Step 10: Commands in `CLAUDE.md`**

Replace the `build:course` line with:

```sh
npm run build:course     # content -> dist/courses/<course>/<learner>.json + index.json (fails on any checker error); one course: npm run build:course -- zh-china
```

and in the mermaid diagram `dist/courses/&lt;id&gt;/course.json` → `dist/courses/&lt;id&gt;/&lt;learner&gt;.json`. In `## Rules` "Never edit generated files" keep as is.

- [ ] **Step 11: Commit**

```bash
git add content/courses content/learner/en/ui.ftl tools/src tools/test CLAUDE.md
git commit -m "build: one course file per reading language, a catalog, language names; rtl refused"
```

---

### Task 4: App — reading-language locale, readings, spaced echo

**Files:**
- Modify: `packages/tui/src/text.ts:10`, `packages/tui/src/app.ts`, `packages/tui/src/notebook.ts:43`, `packages/tui-node/src/main.ts` and `packages/tui-web/src/main.ts` (only their `makeText` calls)
- Test: `packages/tui/test/app.test.ts`, `packages/tui/test/notebook.test.ts`, `packages/tui/test/text.test.ts`

**Interfaces:**
- Consumes: `joinTiles`, `Word.readings`, `Course.learner` (Task 2).
- Produces: `makeText(ftl: string, locale: string): Text` (no default).

- [ ] **Step 1: Write the failing tests**

In `packages/tui/test/fake-terminal.ts` add:

```ts
/** The spaced test course with the real English UI text. */
export function spacedWithText(): Course {
  const ui = readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8");
  return { ...spacedCourse(), learnerFtl: ui + NARRATION };
}
```

(import `spacedCourse` from `@silver-tongue/core/testing`). In `app.test.ts` let `setup` take the course maker: `function setup(patch = …, change = …, make: () => Course = fixtureWithText)` and use `make()` in place of `fixtureWithText()`. Then add:

```ts
describe("languages", () => {
  const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
  const allKnown = (s: GameState) => {
    for (const id of Object.keys(spacedWithText().words)) s.words[id] = { ...known };
    s.place = "noodle_shop";
  };

  it("shows tiles and the echo with spaces in a spaced language", () => {
    const { term, core } = setup(allKnown, () => {}, spacedWithText);
    term.resize(46, 20);
    term.press("1"); // talk to the cook
    expect(core.state.run!.mode).toBe("tiles");
    const run = core.state.run!;
    for (const p of ["mi", "bon"]) term.press(String(run.tiles.indexOf(p) + 1));
    expect(term.screen().join("\n")).toContain("mi bon");
    term.press("return");
    expect(term.screen().join("\n")).toContain("You: mi bon!");
  });

  it("shows every reading in word help, and the last one for the sentence", () => {
    const { term } = setup(() => {}, () => {}, spacedWithText);
    term.resize(46, 20);
    term.press("1", "1"); // go to the noodle shop, talk to the cook
    term.press("w", "1");
    expect(term.screen().join("\n")).toContain("mi mí mi — you");
    term.press("s");
    expect(term.screen().join("\n")).toContain("mi bon! mi bon — Hello!");
  });
});
```

Menu positions depend on the fixture's menu (street → noodle shop is "1", the cook's scene is "1" there): read the first `term.screen()` in a scratch run and adjust the key presses before relying on them; the assertions stay.

In `notebook.test.ts` add a test that a word with `readings: ["mí", "mi"]` shows `mí mi` after its text (build the course with `spacedCourse()` and a state with `words.w_ni` recorded, call `notebookLines`, and `expect(lines.map(plain).join("\n")).toContain("mi mí mi — you")`).

In `text.test.ts` add:

```ts
  it("formats numbers in the reading language's locale", () => {
    const t = makeText("n = { $n }", "de");
    expect(t("n", { n: 1234.5 })).toBe("1.234,5");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/tui`
Expected: FAIL — the echo shows `mibon`, word help shows only the first reading formatted by the Task 2 stopgap (or passes: then check the sentence line, which must show the last reading), and German formatting gives `1,234.5`.

- [ ] **Step 3: Implement**

`text.ts:10`: `export function makeText(ftl: string, locale: string): Text {`. Update callers: `app.ts:56` `makeText(course.learnerFtl, course.learner)`; `tui-node/src/main.ts` and `tui-web/src/main.ts` `makeText(course.learnerFtl, course.learner)`; tests that call `makeText(x)` pass `"en"`.

`app.ts`:
- import `joinTiles` from core.
- `tiles-answer` line (`:347`): `{ text: joinTiles(course, tileInput.map((i) => tiles[i])), bold: true }`.
- Return handler (`:480-483`):

```ts
      const placed = joinTiles(course, tileInput.map((i) => tiles[i]));
      const reply = rightReply();
      const name = core.state.player ?? "";
      const right = !!reply && joinTiles(course, tilePieces(reply).map((x) => (x === PLAYER_MARK ? name : x))) === placed;
```

- Word help (`:444`): `...(w.readings?.length ? [{ text: ` ${w.readings.join(" ")}`, color: "yellow" as const }] : []),`
- Sentence help (`:458`): `const reading = lastLine.tokens.flatMap((tk) => course.words[tk.word]?.readings?.at(-1) ?? []).join(" ");` and use `reading` in the push.

`notebook.ts:43`: same as word help.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/tui && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/tui packages/tui-node/src/main.ts packages/tui-web/src/main.ts
git commit -m "tui: the reading language's locale, every reading, spaces between tiles in a spaced language"
```

---

### Task 5: App — the settings screen

**Files:**
- Modify: `packages/tui/src/app.ts`, `packages/tui/src/text.ts` (`UI_KEYS`), `content/learner/en/ui.ftl`
- Test: `packages/tui/test/app.test.ts`

**Interfaces:**
- Consumes: `CatalogEntry` (Task 2).
- Produces:
  ```ts
  // AppOptions gains:
  settings?: {
    /** the catalog; the course and reading language being played are opts.course.id and opts.course.learner */
    courses: CatalogEntry[];
    /** the player chose another course or reading language: the app has saved; restart it with this */
    switchTo(course: string, learner: string): void;
  };
  ```
  UI ids: `settings-title`, `settings-learning` {language}, `settings-reading` {learner}, `settings-sound` {sound}, `settings-sound-on`, `settings-sound-off`, `settings-sound-none`, `settings-pick-course`, `settings-pick-reading`, `settings-current`, `keys-settings` {keys}, `keys-settings-pick` {keys}, `keys-o`, `start-title`, `start-ask`.

- [ ] **Step 1: UI text**

Append to `content/learner/en/ui.ftl`:

```ftl
## Settings ([o])
settings-title = Settings
settings-learning = Learning: { $language }
settings-reading = Reading: { $learner }
settings-sound = Sound: { $sound }
settings-sound-on = on
settings-sound-off = off
settings-sound-none = no audio
settings-pick-course = Learn:
settings-pick-reading = Read the game in:
settings-current = (now)
keys-settings = [{ $keys }] change · [esc] back
keys-settings-pick = [{ $keys }] choose · [esc] back
keys-o = [o] settings
## Choosing a course before the game starts
start-title = What do you want to learn?
start-ask = Number (enter to quit):
```

Add each id with its variables to `UI_KEYS` in `text.ts` (`"settings-learning": ["language"]`, `"settings-reading": ["learner"]`, `"settings-sound": ["sound"]`, `"keys-settings": ["keys"]`, `"keys-settings-pick": ["keys"]`, the rest `[]`).

- [ ] **Step 2: Write the failing tests**

In `app.test.ts` extend `setup` with an optional `settings` argument passed to `startApp`, and add:

```ts
describe("settings screen", () => {
  const catalog: CatalogEntry[] = [
    { id: "test-course", language: "zh", setting: "s", learners: ["en", "fr"], learnerNames: { en: "English", fr: "Français" } },
    { id: "xx-town", language: "xx", setting: "s", learners: ["en"], learnerNames: { en: "English" } },
  ];
  const withSettings = () => {
    const calls: [string, string][] = [];
    const s = setup(() => {}, (c) => (c.learnerFtl += "\nlanguage-zh = Chinese\nlanguage-xx = Testish\n"), fixtureWithText, {
      courses: catalog,
      switchTo: (course, learner) => calls.push([course, learner]),
    });
    s.term.resize(46, 20);
    return { ...s, calls };
  };

  it("lists what is learned, the reading language and sound, at 46 columns", () => {
    const { term } = withSettings();
    term.press("o");
    const screen = term.screen().join("\n");
    expect(screen).toContain("Settings");
    expect(screen).toContain("1) Learning: Chinese");
    expect(screen).toContain("2) Reading: English");
    expect(screen).toContain("3) Sound: no audio");
    expect(screen).toContain("[1-3] change");
    for (const l of term.frames.at(-1)!) expect(lineWidth(l)).toBe(46);
    term.press("escape");
    expect(term.screen().join("\n")).not.toContain("Settings");
  });

  it("switches course, keeping the reading language when the other course has it", () => {
    const { term, calls, saves } = withSettings();
    const before = saves.length;
    term.press("o", "1");
    expect(term.screen().join("\n")).toContain("1) Chinese (now)");
    expect(term.screen().join("\n")).toContain("2) Testish");
    term.press("2");
    expect(calls).toEqual([["xx-town", "en"]]);
    expect(saves.length).toBe(before + 1); // saves before switching
  });

  it("switches reading language", () => {
    const { term, calls } = withSettings();
    term.press("o", "2");
    expect(term.screen().join("\n")).toContain("2) Français");
    term.press("2");
    expect(calls).toEqual([["test-course", "fr"]]);
  });

  it("does nothing when the current entry is chosen", () => {
    const { term, calls } = withSettings();
    term.press("o", "1", "1");
    expect(calls).toEqual([]);
    expect(term.screen().join("\n")).toContain("1) Learning: Chinese");
  });

  it("opens from a scene and help, and goes back there", () => {
    const { term } = withSettings();
    term.press("1", "1"); // into the cook's scene (adjust to the fixture menu as in Task 4)
    term.press("w", "o");
    expect(term.screen().join("\n")).toContain("Settings");
    term.press("escape");
    expect(term.screen().join("\n")).toContain("Which word?"); // back in help, not explore
  });

  it("toggles sound from the settings screen", () => {
    const audio: AudioOut = { available: true, play: () => {}, stop: () => {} };
    const { term, core } = setup(() => {}, (c) => (c.learnerFtl += "\nlanguage-zh = Chinese\n"), fixtureWithText, { courses: catalog, switchTo: () => {} }, audio);
    term.press("o", "3");
    expect(core.state.sound).toBe(false);
    expect(term.screen().join("\n")).toContain("3) Sound: off");
  });

  it("has no [o] without settings", () => {
    const { term, core } = setup();
    term.press("o");
    expect(term.screen().join("\n")).not.toContain("Settings");
    expect(term.screen().join("\n")).not.toContain("[o]");
    expect(core.state.day).toBe(1);
  });

  it("lists [o] in the footer when there is room", () => {
    const { term } = withSettings();
    term.resize(120, 20);
    expect(term.screen().at(-1)).toContain("[o] settings");
  });
});
```

`setup` gains two optional trailing parameters, `settings?: AppOptions["settings"]` and `audio?: AudioOut`, passed to `startApp`.

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run packages/tui/test/app.test.ts -t "settings screen"`
Expected: FAIL — `o` does nothing.

- [ ] **Step 4: Implement**

In `app.ts`:

```ts
type Mode = "explore" | "scene" | "help" | "notebook" | "name" | "settings" | "settings-course" | "settings-reading";
```

State: `let settingsFrom: Mode = "explore";`

Helpers inside `startApp`:

```ts
  const catalogEntry = () => opts.settings?.courses.find((c) => c.id === course.id);
  const languageName = (code: string) => (t.has(`language-${code}`) ? t(`language-${code}`) : code);
  const soundLabel = () =>
    !opts.audio?.available ? t("settings-sound-none") : core.state.sound === false ? t("settings-sound-off") : t("settings-sound-on");
  /** The list the settings screen shows: its rows, and what choosing each one does. */
  function settingsRows(): { label: string; choose: () => void }[] {
    const list = opts.settings!.courses;
    if (mode === "settings-course") {
      return list.map((c) => ({
        label: languageName(c.language) + (c.id === course.id ? ` ${t("settings-current")}` : ""),
        choose: () => {
          if (c.id === course.id) return void (mode = "settings");
          switchTo(c.id, c.learners.includes(course.learner) ? course.learner : c.learners[0]);
        },
      }));
    }
    if (mode === "settings-reading") {
      const entry = catalogEntry();
      return (entry?.learners ?? [course.learner]).map((code) => ({
        label: (entry?.learnerNames[code] ?? code) + (code === course.learner ? ` ${t("settings-current")}` : ""),
        choose: () => (code === course.learner ? void (mode = "settings") : switchTo(course.id, code)),
      }));
    }
    return [
      { label: t("settings-learning", { language: languageName(course.language.code) }), choose: () => void (mode = "settings-course") },
      { label: t("settings-reading", { learner: catalogEntry()?.learnerNames[course.learner] ?? course.learner }), choose: () => void (mode = "settings-reading") },
      { label: t("settings-sound", { sound: soundLabel() }), choose: () => void soundKey("m") },
    ];
  }
  function switchTo(courseId: string, learner: string) {
    opts.audio?.stop();
    persist();
    opts.settings!.switchTo(courseId, learner);
  }
```

`prompt()` — before the `mode === "explore"` branch:

```ts
    if (mode === "settings" || mode === "settings-course" || mode === "settings-reading") {
      const title = mode === "settings" ? "settings-title" : mode === "settings-course" ? "settings-pick-course" : "settings-pick-reading";
      return [[{ text: t(title), dim: true }], ...settingsRows().map((r, i) => [{ text: `${i + 1}) ${r.label}` }])];
    }
```

`render()` footer selection — add before the `mode === "name"` case:

```ts
      mode === "settings" ? ["keys-settings", 3]
      : mode === "settings-course" || mode === "settings-reading" ? ["keys-settings-pick", settingsRows().length]
      : …existing chain
```

and after `const footer = t(footerId, …)`:

```ts
    // [o] is listed last, so a narrow screen drops it first.
    const withO = opts.settings && ["explore", "scene", "help"].includes(mode) ? `${footer} · ${t("keys-o")}` : footer;
```

using `withO` in place of `footer` for both `footer` and `footerRight(…)` in the `renderScreen` call. ("scene" here covers both pick and tiles footers.)

`press()` — after the notebook block and before `if (key.name === "n" …)`:

```ts
    if (mode === "settings" || mode === "settings-course" || mode === "settings-reading") {
      const rows = settingsRows();
      const n = /^[1-9]$/.test(key.name) ? Number(key.name) - 1 : -1;
      if (key.name === "escape") mode = mode === "settings" ? settingsFrom : "settings";
      else if (n >= 0 && n < rows.length) rows[n].choose();
      return render();
    }
    if (key.name === "o" && opts.settings && (mode === "explore" || mode === "scene" || mode === "help")) {
      settingsFrom = mode;
      mode = "settings";
      return render();
    }
```

`soundKey("m")` when audio is unavailable already does nothing; the row then keeps saying "no audio".

- [ ] **Step 5: Run the tests**

Run: `npx vitest run packages/tui && npm run build:course`
Expected: PASS; the build passes `uiTextProblems` with the new keys.

- [ ] **Step 6: Commit**

```bash
git add packages/tui content/learner/en/ui.ftl
git commit -m "tui: an [o] settings screen to switch course, reading language and sound"
```

---

### Task 6: Shared start logic — player settings and choosing a course

**Files:**
- Create: `packages/tui/src/choose.ts`
- Modify: `packages/tui/src/index.ts`
- Test: `packages/tui/test/choose.test.ts`

**Interfaces:**
- Consumes: `CatalogEntry` (Task 2), `Text` (`text.ts`).
- Produces:
  ```ts
  export interface PlayerSettings { course?: string; learner?: string }
  export function parseSettings(raw: string | null | undefined): PlayerSettings
  export type Start = { ask: true } | { ask: false; course: CatalogEntry; learner: string } | { error: string };
  export function chooseStart(catalog: CatalogEntry[], settings: PlayerSettings, flags?: { learn?: string; read?: string }): Start
  export function learnerFor(entry: CatalogEntry, ...wanted: (string | undefined)[]): string
  export function courseLabels(catalog: CatalogEntry[], t: Text): string[]
  ```

- [ ] **Step 1: Write the failing tests**

`packages/tui/test/choose.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@silver-tongue/core";
import { chooseStart, courseLabels, parseSettings } from "../src/choose";
import { makeText } from "../src/text";

const zh: CatalogEntry = { id: "zh-china", language: "zh", setting: "china-city", learners: ["en"], learnerNames: { en: "English" } };
const xx: CatalogEntry = { id: "xx-town", language: "xx", setting: "town", learners: ["en", "fr"], learnerNames: { en: "English", fr: "Français" } };

describe("player settings", () => {
  it("reads a course and a reading language", () => {
    expect(parseSettings('{"course":"zh-china","learner":"en"}')).toEqual({ course: "zh-china", learner: "en" });
  });
  it("ignores garbage, other types and extra fields", () => {
    expect(parseSettings("nope")).toEqual({});
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings("[1]")).toEqual({});
    expect(parseSettings('{"course":3,"learner":"en","x":1}')).toEqual({ learner: "en" });
  });
});

describe("choosing the course at start", () => {
  it("takes --learn by language code or course id", () => {
    expect(chooseStart([zh, xx], {}, { learn: "xx" })).toEqual({ ask: false, course: xx, learner: "en" });
    expect(chooseStart([zh, xx], {}, { learn: "zh-china" })).toEqual({ ask: false, course: zh, learner: "en" });
  });
  it("says so when --learn names nothing", () => {
    expect(chooseStart([zh], {}, { learn: "ja" })).toEqual({ error: 'no course for "ja"' });
  });
  it("takes --read when the course has it, else the saved one, else the first", () => {
    expect(chooseStart([xx], {}, { read: "fr" })).toMatchObject({ learner: "fr" });
    expect(chooseStart([xx], { learner: "fr" }, { read: "de" })).toMatchObject({ learner: "fr" });
    expect(chooseStart([xx], { learner: "de" })).toMatchObject({ learner: "en" });
  });
  it("uses the saved course when the catalog still has it", () => {
    expect(chooseStart([zh, xx], { course: "xx-town" })).toMatchObject({ course: xx });
  });
  it("ignores an unknown saved course: the only course, else ask", () => {
    expect(chooseStart([zh], { course: "gone" })).toMatchObject({ course: zh });
    expect(chooseStart([zh, xx], { course: "gone" })).toEqual({ ask: true });
  });
  it("falls back to the course's first reading language", () => {
    expect(chooseStart([zh], { course: "zh-china", learner: "fr" })).toEqual({ ask: false, course: zh, learner: "en" });
  });
  it("labels courses by language name in the reading language", () => {
    const t = makeText("language-zh = Chinese", "en");
    expect(courseLabels([zh, xx], t)).toEqual(["1) Chinese", "2) xx"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/tui/test/choose.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/tui/src/choose.ts`**

```ts
import type { CatalogEntry } from "@silver-tongue/core";
import type { Text } from "./text";

/** What the player chose, kept apart from any course's saves. */
export interface PlayerSettings {
  /** the course being learned */
  course?: string;
  /** the reading language */
  learner?: string;
}

/** Settings from their stored text; anything unreadable is left unset, never an error. */
export function parseSettings(raw: string | null | undefined): PlayerSettings {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "null");
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const d = data as Record<string, unknown>;
  const out: PlayerSettings = {};
  if (typeof d.course === "string") out.course = d.course;
  if (typeof d.learner === "string") out.learner = d.learner;
  return out;
}

export type Start = { ask: true } | { ask: false; course: CatalogEntry; learner: string } | { error: string };

/** The first of `wanted` the course can be read in, else its default. */
export function learnerFor(entry: CatalogEntry, ...wanted: (string | undefined)[]): string {
  return wanted.find((w) => w !== undefined && entry.learners.includes(w)) ?? entry.learners[0];
}

/** --learn, else the saved course, else the only course; otherwise the player is asked. */
export function chooseStart(catalog: CatalogEntry[], settings: PlayerSettings, flags: { learn?: string; read?: string } = {}): Start {
  let course: CatalogEntry | undefined;
  if (flags.learn !== undefined) {
    course = catalog.find((c) => c.id === flags.learn) ?? catalog.find((c) => c.language === flags.learn);
    if (!course) return { error: `no course for "${flags.learn}"` };
  } else {
    course = catalog.find((c) => c.id === settings.course) ?? (catalog.length === 1 ? catalog[0] : undefined);
  }
  if (!course) return { ask: true };
  return { ask: false, course, learner: learnerFor(course, flags.read, settings.learner) };
}

/** "1) Chinese", … : each course by the name of its language. */
export function courseLabels(catalog: CatalogEntry[], t: Text): string[] {
  return catalog.map((c, i) => `${i + 1}) ${t.has(`language-${c.language}`) ? t(`language-${c.language}`) : c.language}`);
}
```

`packages/tui/src/index.ts`: `export * from "./choose";`

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/tui/test/choose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/choose.ts packages/tui/src/index.ts packages/tui/test/choose.test.ts
git commit -m "tui: player settings and choosing a course at start, shared by both front ends"
```

---

### Task 7: Terminal — flags, settings file, catalog, migration, switching, bundle

**Files:**
- Create: `packages/tui-node/src/catalog.ts`, `packages/tui-node/bundle-courses.mjs`
- Modify: `packages/tui-node/src/cli.ts`, `packages/tui-node/src/storage.ts`, `packages/tui-node/src/sessions.ts`, `packages/tui-node/src/main.ts`, `packages/tui-node/package.json` (`bundle` script, `files` if listed), `packages/tui-node/README.md`
- Test: `packages/tui-node/test/cli.test.ts`, `packages/tui-node/test/storage.test.ts`, `packages/tui-node/test/sessions.test.ts`, `packages/tui-node/test/catalog.test.ts`

**Interfaces:**
- Consumes: `chooseStart`, `learnerFor`, `courseLabels`, `parseSettings`, `PlayerSettings` (Task 6); `AppOptions.settings` (Task 5); `CatalogEntry` (Task 2).
- Produces:
  ```ts
  // cli.ts: Flags modes continue|new|resume|export|import gain learn?: string; read?: string
  // storage.ts
  export function writeFileAtomic(path: string, text: string): boolean
  export function settingsPath(configRoot: string): string        // <root>/silver-tongue/settings.json
  export function loadSettings(configRoot: string): PlayerSettings
  export function saveSettings(configRoot: string, s: PlayerSettings): boolean
  // sessions.ts
  export function migrateCourseSessions(configRoot: string, course: { id: string; aliases?: string[] }): void
  // catalog.ts
  export function coursesDir(env?: NodeJS.ProcessEnv): string | undefined
  export function readCatalog(dir: string): CatalogEntry[]
  export function courseFile(dir: string, id: string, learner: string): string
  export function clipsDir(dir: string, entry: { id: string; language: string }): string
  ```

- [ ] **Step 1: Write the failing tests**

`cli.test.ts` add:

```ts
  it("takes --learn and --read with any mode", () => {
    expect(parseFlags(["--learn", "zh", "--read", "en"])).toEqual({ mode: "continue", learn: "zh", read: "en" });
    expect(parseFlags(["--new", "--learn", "zh-china"])).toEqual({ mode: "new", learn: "zh-china" });
    expect(parseFlags(["--export", "--learn", "zh"])).toEqual({ mode: "export", learn: "zh" });
  });
```

`storage.test.ts` add (temp dir helper as the file already uses):

```ts
  it("saves settings and reads them back", () => {
    const root = tempRoot();
    expect(saveSettings(root, { course: "zh-china", learner: "en" })).toBe(true);
    expect(loadSettings(root)).toEqual({ course: "zh-china", learner: "en" });
  });
  it("reads a missing or broken settings file as no settings", () => {
    const root = tempRoot();
    expect(loadSettings(root)).toEqual({});
    mkdirSync(join(root, "silver-tongue"), { recursive: true });
    writeFileSync(settingsPath(root), "{oops");
    expect(loadSettings(root)).toEqual({});
  });
```

`sessions.test.ts` add:

```ts
  it("moves every alias file, renaming clashes and keeping times", () => {
    const root = tempRoot();
    const oldDir = sessionsDir(root, "old");
    const newDir = sessionsDir(root, "new");
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(oldDir, "2026-09-25-100000.json"), "a");
    writeFileSync(join(oldDir, "2026-09-25-100000.json.invalid-backup"), "b");
    writeFileSync(join(newDir, "2026-09-25-100000.json"), "c");
    utimesSync(join(oldDir, "2026-09-25-100000.json"), 1000, 1000);
    writeFileSync(join(root, "silver-tongue", "old.json"), "legacy");
    migrateCourseSessions(root, { id: "new", aliases: ["old"] });
    expect(readdirSync(newDir).sort()).toEqual([
      "2026-09-25-100000-2.json",
      "2026-09-25-100000.json",
      "2026-09-25-100000.json.invalid-backup",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}-\d{6}\.json$/),
    ].sort());
    expect(readFileSync(join(newDir, "2026-09-25-100000-2.json"), "utf8")).toBe("a");
    expect(statSync(join(newDir, "2026-09-25-100000-2.json")).mtimeMs).toBe(1_000_000);
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(join(root, "silver-tongue", "old.json"))).toBe(false);
  });
```

The `expect.stringMatching` entry can sort anywhere; if the sorted comparison is awkward, assert the length is 4 and each of the three known names is present, plus one legacy-named file that reads `legacy`.

`catalog.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clipsDir, courseFile, coursesDir, readCatalog } from "../src/catalog";

describe("catalog", () => {
  it("uses SILVER_TONGUE_COURSES when set", () => {
    expect(coursesDir({ SILVER_TONGUE_COURSES: "/x" })).toBe("/x");
  });
  it("reads the index and names course files", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-cat-"));
    writeFileSync(join(dir, "index.json"), JSON.stringify([{ id: "a", language: "zh", setting: "s", learners: ["en"], learnerNames: { en: "English" } }]));
    expect(readCatalog(dir).map((e) => e.id)).toEqual(["a"]);
    expect(courseFile(dir, "a", "en")).toBe(join(dir, "a", "en.json"));
  });
  it("finds clips beside the course when bundled", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-cat-"));
    mkdirSync(join(dir, "a", "audio"), { recursive: true });
    expect(clipsDir(dir, { id: "a", language: "zh" })).toBe(join(dir, "a", "audio"));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/tui-node`
Expected: FAIL — unknown options, missing exports, missing module.

- [ ] **Step 3: `cli.ts`**

Add options `learn: { type: "string" }, read: { type: "string" }`. Build `const pick = { ...(values.learn !== undefined ? { learn: values.learn } : {}), ...(values.read !== undefined ? { read: values.read } : {}) };` and spread `pick` next to `course` in both returns. Extend the `Flags` union members with `learn?: string; read?: string`. `USAGE` gains:

```
  --learn <code>   learn this language (zh) or course (zh-china); remembered
  --read <code>    read the game in this language (en); remembered
```

- [ ] **Step 4: `storage.ts`**

Extract the body of `writeSave` into

```ts
/** Writes a file so that a crash leaves the old one or the new one, never half of one. False if it couldn't. */
export function writeFileAtomic(path: string, text: string): boolean {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, path);
    return true;
  } catch {
    return false;
  }
}

export function writeSave(path: string, state: GameState): boolean {
  return writeFileAtomic(path, serialize(state));
}

export const settingsPath = (configRoot: string) => join(configRoot, "silver-tongue", "settings.json");

/** The player's settings; a missing or unreadable file means none. */
export function loadSettings(configRoot: string): PlayerSettings {
  try {
    return parseSettings(readFileSync(settingsPath(configRoot), "utf8"));
  } catch {
    return {};
  }
}

export function saveSettings(configRoot: string, s: PlayerSettings): boolean {
  return writeFileAtomic(settingsPath(configRoot), JSON.stringify(s));
}
```

(import `parseSettings`, `type PlayerSettings` from `@silver-tongue/tui`).

- [ ] **Step 5: `sessions.ts`**

```ts
/** `<dir>/<name>`, or with -2, -3, … before `.json` (or at the end) when taken. */
function freeName(dir: string, name: string): string {
  const [base, ext] = name.endsWith(".json") ? [name.slice(0, -5), ".json"] : [name, ""];
  let path = join(dir, name);
  for (let n = 2; existsSync(path); n++) path = join(dir, `${base}-${n}${ext}`);
  return path;
}

/**
 * A course's saves under its earlier ids come with it: the old single-save files and every file in
 * the old sessions folders (backups too) move into its sessions folder, keeping their times.
 */
export function migrateCourseSessions(configRoot: string, course: { id: string; aliases?: string[] }): void {
  migrateLegacySave(configRoot, course.id);
  const dir = sessionsDir(configRoot, course.id);
  for (const alias of course.aliases ?? []) {
    const legacy = join(configRoot, "silver-tongue", `${alias}.json`);
    if (existsSync(legacy)) {
      mkdirSync(dir, { recursive: true });
      renameSync(legacy, newSessionPath(dir, statSync(legacy).mtimeMs));
    }
    const old = sessionsDir(configRoot, alias);
    if (!existsSync(old)) continue;
    mkdirSync(dir, { recursive: true });
    for (const file of readdirSync(old)) renameSync(join(old, file), freeName(dir, file));
    rmdirSync(old);
  }
}
```

(add `rmdirSync` to the import).

- [ ] **Step 6: `catalog.ts`**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "@silver-tongue/core";

/**
 * Where the built courses are: $SILVER_TONGUE_COURSES (for tests and trying a catalog), courses/ next
 * to the bundle when installed, or the repo's dist/courses when run from source.
 */
export function coursesDir(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.SILVER_TONGUE_COURSES) return env.SILVER_TONGUE_COURSES;
  return [new URL("./courses", import.meta.url), new URL("../../../dist/courses", import.meta.url)]
    .map((u) => fileURLToPath(u))
    .find((p) => existsSync(join(p, "index.json")));
}

export function readCatalog(dir: string): CatalogEntry[] {
  return JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as CatalogEntry[];
}

export const courseFile = (dir: string, id: string, learner: string) => join(dir, id, `${learner}.json`);

/** Clips: audio/ beside the course when bundled; the repo's content/audio/<language> from source. */
export function clipsDir(dir: string, entry: { id: string; language: string }): string {
  const beside = join(dir, entry.id, "audio");
  const source = fileURLToPath(new URL(`../../../content/audio/${entry.language}`, import.meta.url));
  return existsSync(beside) || !existsSync(source) ? beside : source;
}
```

- [ ] **Step 7: Run the unit tests**

Run: `npx vitest run packages/tui-node`
Expected: PASS.

- [ ] **Step 8: Rewrite `main.ts`**

Keep the Node-version check, `--version`/`--help`/error handling, `exportOrImport`, `chooseSave` and `bail` as they are, but make them take the course. The new flow:

```ts
const root = configDir();
const term = createNodeTerminal-created lazily (see below);

/** A course to play: its file, its clips, and the catalog entry (none for --course <path>). */
interface Chosen {
  course: Course;
  clips: string;
  entry?: CatalogEntry;
  catalog: CatalogEntry[];
  dir?: string;
}

function loadCourse(dir: string, entry: CatalogEntry, learner: string, catalog: CatalogEntry[]): Chosen {
  const course = JSON.parse(readFileSync(courseFile(dir, entry.id, learner), "utf8")) as Course;
  return { course, clips: clipsDir(dir, entry), entry, catalog, dir };
}

async function start(): Promise<Chosen> {
  if (flags.coursePath) {
    // A course file given on the command line: no catalog, no settings, no switching.
    const course = JSON.parse(readFileSync(flags.coursePath, "utf8")) as Course;
    return { course, clips: join(dirname(flags.coursePath), "audio"), catalog: [] };
  }
  const dir = coursesDir();
  if (!dir) {
    console.error("No built courses found. Run: npm run build:course");
    process.exit(1);
  }
  const catalog = readCatalog(dir);
  const settings = loadSettings(root);
  const picked = chooseStart(catalog, settings, { learn: flags.learn, read: flags.read });
  if ("error" in picked) {
    console.error(`silver-tongue: ${picked.error}\n\n${USAGE}`);
    process.exit(2);
  }
  const entry = picked.ask ? await askCourse(dir, catalog, settings) : picked.course;
  const learner = picked.ask ? learnerFor(entry, flags.read, settings.learner) : picked.learner;
  saveSettings(root, { course: entry.id, learner });
  return loadCourse(dir, entry, learner, catalog);
}

/** A numbered list of courses, labelled in the saved reading language (else English, else any). */
async function askCourse(dir: string, catalog: CatalogEntry[], settings: PlayerSettings): Promise<CatalogEntry> {
  const byLearner = (code?: string) => catalog.find((e) => code !== undefined && e.learners.includes(code));
  const labelled = byLearner(settings.learner) ?? byLearner("en") ?? catalog[0];
  const code = learnerFor(labelled, settings.learner, "en");
  const labelCourse = JSON.parse(readFileSync(courseFile(dir, labelled.id, code), "utf8")) as Course;
  const t = makeText(labelCourse.learnerFtl, code);
  console.log(t("start-title"));
  for (const line of courseLabels(catalog, t)) console.log(line);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const pick = pickAnswer(await rl.question(`${t("start-ask")} `), catalog.length);
      if (pick === "cancel") process.exit(0);
      if (pick !== "again") return catalog[pick];
    }
  } finally {
    rl.close();
  }
}
```

`"en"` appears here as a fallback reading language for the list's labels — that is a language code literal and the guard (Task 9) flags it. Instead take the fallback from the catalog: `const labelled = byLearner(settings.learner) ?? catalog[0]; const code = learnerFor(labelled, settings.learner);` (the first course's default reading language). Use that version.

`chooseSave(chosen, mode)` and `exportOrImport(chosen, …)` replace every `course` global with `chosen.course`, and call `migrateCourseSessions(root, chosen.course)` where they called `migrateLegacySave`. `chooseSave` gains a `mode` parameter so switching can ask for "continue" regardless of the flags.

Playing and switching:

```ts
const term = createNodeTerminal();
let audio: ReturnType<typeof createNodeAudio> | undefined;
// Whatever happens, give the player their terminal back.
const bail = (code: number, error?: unknown) => {
  audio?.stop(); // or a player would keep talking after the game has gone
  term.close();
  if (error) console.error(error);
  process.exit(code);
};
…signal handlers as today…

function play(chosen: Chosen, savePath: string) {
  audio?.stop();
  const { state, notice, readOnly } = loadSave(chosen.course, savePath);
  const core = createCore(chosen.course, state, { now: Date.now, rng: mulberry32(Date.now() >>> 0) });
  audio = createNodeAudio(nodeAudioDeps(chosen.clips));
  startApp({
    course: chosen.course,
    core,
    term,
    now: Date.now,
    notice,
    version: pkg.version,
    audio,
    save: readOnly ? undefined : (s) => writeSave(savePath, s),
    quit: () => bail(0),
    settings: chosen.entry && {
      courses: chosen.catalog,
      switchTo: (id, learner) => {
        const entry = chosen.catalog.find((e) => e.id === id)!;
        saveSettings(root, { course: id, learner });
        const next = loadCourse(chosen.dir!, entry, learner, chosen.catalog);
        // Another reading language keeps the game; another course continues its last one.
        play(next, id === chosen.course.id ? savePath : lastOrNew(next));
      },
    },
  });
}

/** The course's most recent session, or a new one. */
function lastOrNew(chosen: Chosen): string {
  const dir = sessionsDir(root, chosen.course.id);
  try {
    migrateCourseSessions(root, chosen.course);
  } catch {
    // can't move them: the folder is probably unwritable too, and loadSave will say so
  }
  return listSessions(dir, chosen.course)[0]?.path ?? newSessionPath(dir, Date.now());
}

const chosen = await start();
if (flags.mode === "export" || flags.mode === "import") await exportOrImport(chosen, flags.mode, flags.mode === "import" ? flags.line : "");
play(chosen, await chooseSave(chosen));
```

`startApp` calls `term.onKey(press)` and `term.onResize(render)`; `node-terminal.ts:44-49` must replace the previous handler, not add one. Read it: if it adds listeners, change it to keep one handler each (a test in `packages/tui-node/test` that calls `onKey` twice and checks only the second handler runs). If SILVER_TONGUE_SAVE is set, `chooseSave` returns it as today and switching still uses `lastOrNew` for another course.

Also the `SILVER_TONGUE_SAVE` + `--course` combinations keep working as today.

- [ ] **Step 9: Bundle script**

`packages/tui-node/bundle-courses.mjs`:

```js
// Copies the built courses into dist/courses for the npm package: the catalog, each course's
// file per reading language, and each course's clips in <course>/audio/.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const from = join(repo, "dist", "courses");
const to = join(here, "dist", "courses");
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
let clips = 0;
for (const entry of JSON.parse(readFileSync(join(from, "index.json"), "utf8"))) {
  const src = join(repo, "content", "audio", entry.language);
  if (!existsSync(src)) continue;
  const out = join(to, entry.id, "audio");
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(src).filter((f) => f.endsWith(".mp3"))) {
    cpSync(join(src, f), join(out, f));
    clips++;
  }
}
console.log(`bundled ${readdirSync(to).filter((f) => f !== "index.json").join(", ")} with ${clips} clips`);
```

`package.json` `bundle`: `esbuild src/main.ts --bundle --platform=node --format=esm --outfile=dist/silver-tongue.mjs --banner:js=\"#!/usr/bin/env node\" && node bundle-courses.mjs`. If `package.json` has a `files` list, make sure `dist` covers `dist/courses`.

`packages/tui-node/README.md`: document `--learn` and `--read` next to the other flags.

- [ ] **Step 10: Check it end to end**

```bash
npx vitest run packages/tui-node
npm run typecheck
npm run build:course && npm run bundle -w silver-tongue
ls packages/tui-node/dist/courses packages/tui-node/dist/courses/zh-china | head
XDG_CONFIG_HOME=$(mktemp -d) node packages/tui-node/dist/silver-tongue.mjs --learn ja; echo "exit $?"
```

Expected: tests PASS; `index.json  zh-china`; `audio  en.json`; the last command prints `silver-tongue: no course for "ja"` and the usage, `exit 2`.

Then a migration check with a copy of a real 0.12 layout:

```bash
cfg=$(mktemp -d); mkdir -p $cfg/silver-tongue/sessions/zh-china-en
cp ~/.config/silver-tongue/sessions/zh-china-en/*.json $cfg/silver-tongue/sessions/zh-china-en/ 2>/dev/null || true
XDG_CONFIG_HOME=$cfg node packages/tui-node/dist/silver-tongue.mjs --export > /dev/null; ls $cfg/silver-tongue/sessions
```

Expected: `zh-china` only (when there were saves to copy), and `settings.json` in `$cfg/silver-tongue/`.

- [ ] **Step 11: Commit**

```bash
git add packages/tui-node
git commit -m "tui-node: --learn/--read, remembered settings, old saves move to zh-china, switching from [o]"
```

---

### Task 8: Browser — fetched courses, migration, settings, switching

**Files:**
- Modify: `packages/tui-web/build.mjs`, `packages/tui-web/src/web-storage.ts`, `packages/tui-web/src/main.ts`, `packages/tui-web/src/index.html`, `packages/tui-web/src/web-audio.ts` (only if the base must change after creation), `README.md`
- Test: `packages/tui-web/test/web-storage.test.ts`

**Interfaces:**
- Consumes: `chooseStart`, `learnerFor`, `courseLabels`, `parseSettings`, `PlayerSettings` (Task 6); `AppOptions.settings` (Task 5).
- Produces:
  ```ts
  export const SETTINGS_KEY = "silver-tongue:settings";
  export function loadWebSettings(kv: KeyValue): PlayerSettings
  export function saveWebSettings(kv: KeyValue, s: PlayerSettings): boolean
  export function migrateWebAliases(kv: KeyValue, course: { id: string; aliases?: string[] }): void
  ```

- [ ] **Step 1: Write the failing tests**

In `web-storage.test.ts` (it has an in-memory `KeyValue`; call it `memoryKv()` here — use the helper the file already defines):

```ts
describe("settings and old course ids", () => {
  it("saves settings and ignores a broken value", () => {
    const kv = memoryKv();
    expect(loadWebSettings(kv)).toEqual({});
    expect(saveWebSettings(kv, { course: "zh-china", learner: "en" })).toBe(true);
    expect(loadWebSettings(kv)).toEqual({ course: "zh-china", learner: "en" });
    kv.setItem(SETTINGS_KEY, "{bad");
    expect(loadWebSettings(kv)).toEqual({});
  });

  it("moves alias keys and keeps the last game", () => {
    const kv = memoryKv();
    const course = { ...fixtureCourse(), aliases: ["old"] };
    const state = { ...newGame(course), course: "old" };
    kv.setItem("silver-tongue:old:session:a", serialize(state));
    kv.setItem("silver-tongue:old:session:b", serialize(state));
    kv.setItem("silver-tongue:old:invalid-backup:b:x", "junk");
    kv.setItem("silver-tongue:old:meta", JSON.stringify({ last: "a", played: { a: 5, b: 3 } }));
    kv.setItem(`silver-tongue:${course.id}:session:b`, serialize(newGame(course)));
    migrateWebAliases(kv, course);
    expect(kv.keys().filter((k) => k.startsWith("silver-tongue:old:"))).toEqual([]);
    const sessions = new WebSessions(kv, course, () => 10);
    expect(sessions.list().map((s) => s.id).sort()).toEqual(["a", "b", "b-2"]);
    expect(sessions.continueLast().id).toBe("a");
    expect(kv.getItem(`silver-tongue:${course.id}:invalid-backup:b:x`)).toBe("junk");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/tui-web`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement in `web-storage.ts`**

```ts
export const SETTINGS_KEY = "silver-tongue:settings";

export function loadWebSettings(kv: KeyValue): PlayerSettings {
  try {
    return parseSettings(kv.getItem(SETTINGS_KEY));
  } catch {
    return {};
  }
}

export function saveWebSettings(kv: KeyValue, s: PlayerSettings): boolean {
  try {
    kv.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/**
 * Games saved under a course's earlier ids move to its own: sessions (renamed -2, -3, … on a clash),
 * backups, and which game was played last and when. Storage errors leave what can't move in place.
 */
export function migrateWebAliases(kv: KeyValue, course: { id: string; aliases?: string[] }): void {
  const to = `silver-tongue:${course.id}:`;
  for (const alias of course.aliases ?? []) {
    const from = `silver-tongue:${alias}:`;
    try {
      const keys = kv.keys().filter((k) => k.startsWith(from));
      if (!keys.length) continue;
      const readMeta = (key: string): Meta => {
        try {
          const m = JSON.parse(kv.getItem(key) ?? "null") as Meta | null;
          return m && typeof m.played === "object" && m.played && !Array.isArray(m.played) ? m : { played: {} };
        } catch {
          return { played: {} };
        }
      };
      const oldMeta = readMeta(`${from}meta`);
      const meta = readMeta(`${to}meta`);
      const renamed: Record<string, string> = {};
      for (const key of keys) {
        const rest = key.slice(from.length);
        if (rest === "meta") continue;
        let target = `${to}${rest}`;
        if (rest.startsWith("session:")) {
          const id = rest.slice("session:".length);
          let newId = id;
          for (let n = 2; kv.getItem(`${to}session:${newId}`) !== null; n++) newId = `${id}-${n}`;
          renamed[id] = newId;
          target = `${to}session:${newId}`;
        } else {
          for (let n = 2; kv.getItem(target) !== null; n++) target = `${to}${rest}-${n}`;
        }
        kv.setItem(target, kv.getItem(key) ?? "");
        kv.removeItem(key);
      }
      for (const [id, at] of Object.entries(oldMeta.played)) if (renamed[id]) meta.played[renamed[id]] = at;
      // The game played last overall stays the one played last.
      const lastOld = oldMeta.last && renamed[oldMeta.last];
      const lastAt = (m: Meta, id?: string) => (id ? (m.played[id] ?? 0) : -1);
      if (lastOld && lastAt(oldMeta, oldMeta.last) >= lastAt(meta, meta.last)) meta.last = lastOld;
      kv.setItem(`${to}meta`, JSON.stringify(meta));
      kv.removeItem(`${from}meta`);
    } catch {
      // storage refused: the old games stay where they are and can move next time
    }
  }
}
```

Import `parseSettings`, `type PlayerSettings` from `@silver-tongue/tui`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/tui-web`
Expected: PASS.

- [ ] **Step 5: `build.mjs`**

Replace the course read, the `__COURSE__` define and the audio copy:

```js
// Builds dist/index.html (the app, xterm.js and its CSS in one file) and dist/courses/: the catalog,
// each course file and each course's clips. The page fetches the course it plays, so it needs a web
// server (GitHub Pages, npx serve); it no longer works opened straight from disk.
…
  define: {
    __VERSION__: JSON.stringify(JSON.parse(readFileSync(join(repo, "packages", "tui-node", "package.json"), "utf8")).version),
  },
…
const coursesOut = join(here, "dist", "courses");
rmSync(join(here, "dist", "audio"), { recursive: true, force: true }); // the 0.12 layout
rmSync(coursesOut, { recursive: true, force: true });
cpSync(join(repo, "dist", "courses"), coursesOut, { recursive: true });
let clips = 0;
for (const entry of JSON.parse(readFileSync(join(coursesOut, "index.json"), "utf8"))) {
  const src = join(repo, "content", "audio", entry.language);
  if (!existsSync(src)) continue;
  cpSync(src, join(coursesOut, entry.id, "audio"), { recursive: true, filter: (f) => !f.endsWith(".part") });
  clips += readdirSync(join(coursesOut, entry.id, "audio")).length;
}
console.log(`built packages/tui-web/dist/index.html (${Math.round(html.length / 1024)} KB) and dist/courses/ with ${clips} clips`);
```

(add `existsSync` to the import; remove `courseId` and `course`).

- [ ] **Step 6: `index.html`**

- `<html lang="en">` → `<html>` (the script sets `lang` to the reading language).
- In `#keybar` add `<button data-key="o">o</button>` after the `p` button.

- [ ] **Step 7: `main.ts`**

Replace the `__COURSE__` declaration and the top-level `course`/`t`/`sessions` with mutable ones set by a loader, and start asynchronously:

```ts
declare const __VERSION__: string;

let catalog: CatalogEntry[] = [];
let course: Course;
let t: Text;
let sessions: WebSessions;
let audio: AudioOut & { stop(): void };

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** Loads a course file, moves its old saves, and relabels the page in its reading language. */
async function loadCourse(entry: CatalogEntry, learner: string) {
  course = await fetchJson<Course>(`courses/${entry.id}/${learner}.json`);
  t = makeText(course.learnerFtl, course.learner);
  document.documentElement.lang = course.learner;
  migrateWebAliases(kv, course);
  sessions = new WebSessions(kv, course, Date.now);
  audio?.stop();
  audio = createWebAudio({
    base: `courses/${entry.id}/audio/`,
    audio: typeof Audio === "undefined" ? undefined : new Audio(),
    wait: (ms, cb) => {
      const h = setTimeout(cb, ms);
      return { cancel: () => clearTimeout(h) };
    },
  });
  saveWebSettings(kv, { course: entry.id, learner });
  labelControls();
}
```

- `labelControls()` does what the `controls` loop's `b.textContent = t(id)` and `$("#dialog-close").textContent = t("web-close")` do today; register the click listeners once at start, outside it.
- `play(opened)` passes `settings: { courses: catalog, switchTo }` to `startApp`, where

```ts
async function switchTo(id: string, learner: string) {
  const entry = catalog.find((e) => e.id === id)!;
  const keep = id === course.id ? current?.id : undefined;
  await loadCourse(entry, learner);
  // Another reading language keeps the game; another course continues its last one.
  play(keep !== undefined ? sessions.open(keep) : sessions.continueLast());
}
```

  (`switchTo` in `AppOptions` returns `void`; pass `(id, l) => void switchTo(id, l)`.)
- Start:

```ts
async function boot() {
  try {
    catalog = await fetchJson<CatalogEntry[]>("courses/index.json");
  } catch {
    status("The game could not load. Serve this page from a web server and reload.");
    return;
  }
  const settings = loadWebSettings(kv);
  const picked = chooseStart(catalog, settings);
  if ("error" in picked) return;
  if (!picked.ask) {
    await loadCourse(picked.course, picked.learner);
    return play(sessions.continueLast());
  }
  // Several courses and none chosen yet: the start dialog, labelled by the first course's text.
  await loadCourse(catalog[0], learnerFor(catalog[0], settings.learner));
  const labels = courseLabels(catalog, t);
  const buttons = catalog.map((entry, i) => {
    const b = el("button", { className: "game", textContent: labels[i].replace(/^\d+\) /, "") });
    b.addEventListener("click", async () => {
      dialog.close();
      await loadCourse(entry, learnerFor(entry, settings.learner));
      play(sessions.continueLast());
    });
    return b;
  });
  openDialog(el("h2", { textContent: t("start-title") }), ...buttons);
}
void boot();
```

The one English sentence in `boot`'s catch is shown only when no course text could be fetched at all; keep it (there is no reading-language text to take it from) and ledger it as a ruling. `showGames`/`showImport` keep using the current `course`, `t` and `sessions`. The "saved" status handler and key bar handler use the current `t`.

- [ ] **Step 8: README**

In `README.md`'s browser section add: "The page fetches its course files, so serve `packages/tui-web/dist` from a web server (for example `npx serve packages/tui-web/dist`); opening `index.html` straight from disk no longer works."

- [ ] **Step 9: Check it**

```bash
npx vitest run packages/tui-web && npm run typecheck -- && npm run build:web
ls packages/tui-web/dist packages/tui-web/dist/courses/zh-china | head
```

Expected: tests PASS; `courses  index.html`; `audio  en.json`.

- [ ] **Step 10: Commit**

```bash
git add packages/tui-web README.md
git commit -m "tui-web: fetch the course in use, move old saves, remember settings, switch from [o]"
```

---

### Task 9: The language-free guard

**Files:**
- Create: `tools/test/language-free.test.ts`

**Interfaces:**
- Consumes: the source tree after Tasks 2–8.
- Produces: nothing.

- [ ] **Step 1: Write the test**

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const PACKAGES = join(REPO, "packages");
const FIXTURES = join(PACKAGES, "core", "src", "testing");

/** Every file under packages/<name>/src, test fixtures left out. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (p === FIXTURES) continue;
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  for (const pkg of readdirSync(PACKAGES)) {
    const src = join(PACKAGES, pkg, "src");
    try {
      walk(src);
    } catch {
      // a package without src/
    }
  }
  return out;
}

// Script, not Script_Extensions: the middle dot "·" has Han among its extensions.
const SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
// Language codes: every language and reading language in content/, and common ones besides.
const CODES = [
  ...readdirSync(join(REPO, "content", "languages")),
  ...readdirSync(join(REPO, "content", "learner")),
  "zh", "ja", "ko", "en", "es", "fr", "de", "ar", "ru", "pt", "it", "hi",
];
const CODE = new RegExp(`(["'\`])(${[...new Set(CODES)].join("|")})(-[A-Za-z]+)?\\1`);

describe("engine and front ends are free of any particular language", () => {
  const files = sources();

  it("reads the sources", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("has no Han, kana or Hangul characters", () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8").split("\n").flatMap((l, i) => (SCRIPT.test(l) ? [`${relative(REPO, f)}:${i + 1}: ${l.trim()}`] : [])),
    );
    expect(hits).toEqual([]);
  });

  it("names no language code", () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8").split("\n").flatMap((l, i) => (CODE.test(l) ? [`${relative(REPO, f)}:${i + 1}: ${l.trim()}`] : [])),
    );
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tools/test/language-free.test.ts`
Expected: PASS (Tasks 2, 4, 7 and 8 removed the known hits). If it fails, each hit is a real finding: remove the language from that line (a comment describing the content in words, a value taken from the course or catalog), and ledger any case that seems to need a code in the source.

Check the guard catches what it should: temporarily add `const x = "zh";` to `packages/tui/src/app.ts`, run the test, see it FAIL naming that line, then remove it.

- [ ] **Step 3: Commit**

```bash
git add tools/test/language-free.test.ts
git commit -m "test: no particular language in the engine or the front ends"
```

---

### Task 10: Chinese unchanged, play-tests

**Files:**
- Create (scratch only, not committed): `<scratchpad>/demo-catalog.ts`
- Modify: nothing unless a check finds a bug (then TDD the fix in the task that owns the code, ledgered).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full suite, typecheck, build**

```bash
npm run typecheck && npm run build:course && npm test > .superpowers/sdd/2026-09-26-d1-multi-language-platform/t10.txt 2>&1; tail -6 .superpowers/sdd/2026-09-26-d1-multi-language-platform/t10.txt
```

Expected: no type errors; `built zh-china/en: 35 scenes`; all tests pass.

- [ ] **Step 2: Bots give the 0.12.2 numbers**

```bash
npm run bots > .superpowers/sdd/2026-09-26-d1-multi-language-platform/bots-d1.txt
diff <(tail -n +2 .superpowers/sdd/2026-09-26-d1-multi-language-platform/bots-0.12.2.txt) <(tail -n +2 .superpowers/sdd/2026-09-26-d1-multi-language-platform/bots-d1.txt)
```

Expected: no diff (the first line names the course id, which changed).

- [ ] **Step 3: A second built course for the play-test**

Write `<scratchpad>/demo-catalog.ts` (run with `npx tsx`): copy `dist/courses/zh-china` into `<scratchpad>/catalog/zh-china`, write `<scratchpad>/catalog/xx-town/en.json` and `…/fr.json` from `spacedCourse("en")` / `spacedCourse("fr")` with `learnerFtl` = `content/learner/en/ui.ftl` + the `NARRATION` text from `packages/tui/test/fake-terminal.ts` + `language-xx = Testish` (and for `fr`, `learner-name = Français`), and `index.json` listing both (`xx-town` with `learners: ["en", "fr"]`, `learnerNames: { en: "English", fr: "Français" }`).

- [ ] **Step 4: Terminal play-test (pty, 46 columns)**

With `smoke_pty.py` from the scratchpad (46×24), `XDG_CONFIG_HOME=<temp>` and `SILVER_TONGUE_COURSES=<scratchpad>/catalog`:

1. Start: the list shows `1) Chinese`, `2) Testish`; choose 1; name prompt; play the first exchange.
2. `o`: the settings screen fits 46 columns; `1`, `2`: the Testish game starts (a new game).
3. Play to a tiles reply; the answer line and the echo show spaces.
4. `o`, `2`, `2`: the same game reopens in the second reading language, mid-scene.
5. `o`, `1`, `1`: back in the Chinese game where it was left.
6. Quit; `settings.json` holds the last choice; start again: straight into that course.
7. Without `SILVER_TONGUE_COURSES` (real bundle, one course): no start list, `[o]` shows one course.

Expected: each as written; save every screen dump to the workspace.

- [ ] **Step 5: Browser play-test**

```bash
npm run build:web
cp -r <scratchpad>/catalog/xx-town packages/tui-web/dist/courses/ && cp <scratchpad>/catalog/index.json packages/tui-web/dist/courses/
python3 -m http.server 8765 -d packages/tui-web/dist   # in the background
```

With `pw/check.mjs` (Playwright): the start dialog lists both courses; choosing Chinese plays with audio requests to `courses/zh-china/audio/…`; the `o` key-bar button opens settings; switching to Testish and back keeps each game; `document.documentElement.lang` is `en`. Then seed `localStorage` with a `silver-tongue:zh-china-en:session:…` save and `…:meta` and reload: that game opens under `zh-china`. Finally rebuild with `npm run build:web` so `dist` holds only the real catalog.

- [ ] **Step 6: Record**

Ledger each play-test result; commit nothing from the scratchpad.

---

### Task 11: Review and release 0.13.0

- [ ] **Step 1: Whole-branch review** — one Opus reviewer over `git merge-base main HEAD..HEAD` with this plan, the spec, the Review Focus list and the ledger's rulings. Fix every finding, minors included (the user's standing rule), each with a failing test first; full suite green after.

- [ ] **Step 2: Release**

1. `packages/tui-node/package.json` version `0.13.0`.
2. `CHANGELOG.md` top entry:

```markdown
## 0.13.0 (<date>)

- Ready for more languages: each course keeps its own games, and [o] opens settings to switch what you learn, what you read the game in, and sound.
- `--learn` and `--read` choose from the command line, and the game remembers your choice.
- Your games carry over from earlier versions.
- The browser version loads the course it needs, so it must be served from a web server.
```

3. `npm install --package-lock-only`; commit `release: 0.13.0` (package.json, lock, CHANGELOG).
4. `git checkout main && git merge --no-ff d1-multi-language -m "Merge branch 'd1-multi-language': a multi-language platform (0.13.0)"`, `git push origin main`. (The user approves the merge and push at the end of execution, as for earlier releases.)
5. `gh run list --repo Bannerless-Studio/silver-tongue --limit 3` until ci, pages and publish succeed; `npm view silver-tongue version` → `0.13.0`. Check https://bannerless-studio.github.io/silver-tongue/ plays.
6. Republish the progress artifact (0.13.0, milestone D1 done, D2 next, new links); update the status memory.
