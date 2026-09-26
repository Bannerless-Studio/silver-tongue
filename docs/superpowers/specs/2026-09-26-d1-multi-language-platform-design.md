# D1: a multi-language platform

Status: approved in conversation 2026-09-26. Ships as **0.13.0**. D2 (the first Japanese slice) follows
on top of it with its own spec; the part of its design already agreed is recorded at the end.

## Goal

Silver Tongue can hold many courses and many reading languages. A course is one language to learn
in its own world (setting, story, characters, scenes, economy). The player chooses what to learn and
what to read the game in, switches from a settings screen, and each course continues where they left
it. Nothing in the engine or the front ends is written for a particular language: everything
language-specific comes from content and configuration.

Chinese moves onto the platform and plays exactly as before.

## Decisions (from the user)

- Many languages, in both roles: the language learned, and the language the game is read in (UI,
  glosses, meanings, narration, mentor notes).
- Each course has its own configuration (setting, story, characters, …) and its own progress.
- The player switches the language they learn from settings and continues where they left off.
- **Changing the reading language keeps progress:** progress belongs to the language learned and its
  world, not to the reading language.
- The core stays generic; language behaviour comes from configuration.
- A `CHANGELOG.md` entry for every release.

## Terms

- **Language:** `content/languages/<code>/` (a language pack: words, terms, lines, reactions, notes,
  voices, `pack.json`).
- **Reading language:** `content/learner/<code>/` (UI text, glosses, meanings, narration, mentor notes).
  The code calls it the learner language, as today.
- **Setting:** `content/settings/<id>/` (world and scene skeletons).
- **Course:** a language plus a setting, id `<language>-<setting short name>`: `zh-china` (was
  `zh-china-en`), later `ja-japan`.

## Part 1: courses, the catalog and builds

### Course config

`content/courses/zh-china.json` replaces `zh-china-en.json`:

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

- `learners`: the reading languages this course supports; the first is the default.
- `aliases`: old ids whose saves this course accepts.

### Build output

`npm run build:course` builds every course in `content/courses/` (or one, given its id):

- `dist/courses/<course>/<learner>.json`: the built `Course`, as `course.json` is today, with the
  learner text of that reading language. `Course.id` is the course id (`zh-china`), and new fields
  `Course.learner` (`"en"`) and `Course.language` (the profile, Part 3) are added.
- `dist/courses/<course>/audio/`: not written by the build; the front-end bundles copy clips from
  `content/audio/<language>/`.
- `dist/courses/index.json`, the catalog:

  ```json
  [{ "id": "zh-china", "language": "zh", "setting": "china-city", "learners": ["en"] }]
  ```

- A failure in any course fails the build; the error lines name the course and the reading language.
- The checker runs once per course and reading language (the learner text differs).

Each course file is built whole for each reading language (scenes are repeated). That keeps the
`Course` shape the core and front ends already use. The browser fetches only the file in use.

### Names on screen

Each reading language's `ui.ftl` names every language, `language-<code> = Chinese`, and its own name
as it appears in a list of reading languages, `learner-name = English`. The build fails a reading
language that lacks `language-<code>` for a language in a course it supports, or lacks `learner-name`.

### Old saves carry over

- `parseSave` accepts a save whose `course` is the course id or one of its `aliases`, and the loaded
  state gets the course id. The next save writes it.
- Terminal: on start, `sessions/<alias>/` folders are moved into `sessions/<course>/`, keeping every
  file (a name clash gets `-2`, `-3`, … as `newSessionPath` does).
- Browser: keys `silver-tongue:<alias>:…` are copied to `silver-tongue:<course>:…` and then removed.

## Part 2: player settings and switching

### Settings

The player's settings belong to no course:

```ts
interface PlayerSettings {
  /** the course being learned */
  course?: string;
  /** the reading language */
  learner?: string;
}
```

- Terminal: `<config>/silver-tongue/settings.json`, written atomically like saves.
- Browser: `localStorage["silver-tongue:settings"]`.
- An unreadable or unknown value is ignored (treated as unset), never fatal.

The sound setting stays in each course's save (`GameState.sound`, B4); the settings screen's sound row
toggles it for the course being played.

### Starting

1. Course: `--learn <language code or course id>` if given, else `settings.course` if the catalog
   has it, else the only course if there is one, else ask.
2. Reading language: `--read <code>` if given and the course supports it, else `settings.learner` if
   the course supports it, else the course's first `learners` entry.
3. Both are saved to settings.
4. The game loads that course's most recent session, as today.

Asking (terminal) is a numbered list printed before the game, like `--resume`'s. The list shows each
course as `language-<code>` in the reading language (the saved one, else English). In the browser the
start dialog shows the same list.

### The settings screen

`[o] settings` opens it from the menu, the scene and help (not the name prompt or the notebook). Rows:

```
Settings
1) Learning: Chinese
2) Reading: English
3) Sound: on
[1-3] change · [esc] back
```

- **1** lists the catalog's courses. Choosing another one saves the game, remembers the choice and
  opens that course's most recent session (or a new game, which asks for a name if its lines need one).
- **2** lists the course's reading languages by their `learner-name`. Choosing one saves the game and
  reopens the same session with the other text.
- **3** sends `setSound`.
- A list with one entry still shows, so the player sees what is set; choosing the current entry does
  nothing.

The shared app does not load courses. `AppOptions` gains:

```ts
settings?: {
  /** the catalog, and the course and reading language being played */
  courses: CatalogEntry[];
  /** the player chose another course or reading language: save, then restart the app with it */
  switchTo(course: string, learner: string): void;
};
```

Without `settings` (tests, old callers), `[o]` does nothing and the key isn't listed.

The front ends own switching: they save, dispose of the running app, load the other course file and
session, and start the app again. The browser key bar gains `o`.

### Command line

- `--learn <code>` and `--read <code>` choose, and are remembered.
- `--course <path>` (a built course file) keeps working; it bypasses the catalog and settings.
- `--resume`, `--new`, `--export` and `--import` work on the chosen course.

## Part 3: the language profile

`pack.json` already holds most of it. The build copies the profile into every course:

```ts
interface LanguageProfile {
  code: string;      // "zh"
  locale: string;    // Fluent/Intl locale: "zh"
  tts: string;       // speech locale: "zh-CN"
  /** true when words are written with spaces between them */
  spaced: boolean;
}
```

`Course.language: LanguageProfile`. The core and front ends use only these fields:

- **Tiles:** joined with `" "` when `spaced`, `""` otherwise. This happens in the core's answer check
  (`replyTiles`), the app's echo and the tiles-answer line.
- **Readings:** `Word.readings?: string[]` replaces `Word.pron`. A language may give several, most
  native first: Chinese `["nǐ"]`, Japanese `["よっつ", "yottsu"]`.
  - Word help and the notebook show all of them.
  - The whole-sentence help shows each word's last reading, joined with spaces.
  - The pack keeps `pron` (vocab-engine's field) and may add `readings`; the build writes
    `readings: w.readings ?? (w.pron ? [w.pron] : undefined)`.
- **Reading-language text** is formatted with the reading language's locale (`makeText(ftl,
  course.learner)`), not a fixed `en`.

### Still refused (with a clear error)

- A spaced language: its tagger isn't built yet (as today's build error).
- A right-to-left script: `pack.json` may say `"direction": "rtl"`, and the build refuses it until a
  front end supports it.

Each becomes its own project when a language needs it.

### Keeping language out of code

A test (`tools/test/language-free.test.ts`) reads every source file under `packages/*/src`, except
test fixtures (`packages/core/src/testing/`), and fails if one contains:

- a Han, kana or Hangul character, or
- a comparison against a language code (e.g. `=== "zh"`, `"ja"`).

Comments are included, so an example needs to describe content words, not quote them. Today's hits
are what D1 removes anyway: the hard-wired course id in `tui-node/src/main.ts`, `makeText`'s `"en"`
default, and the web page's `lang="en"`, which becomes the reading language's code.

## Part 4: front ends

### Terminal (`tui-node`)

- The bundle ships `dist/courses/index.json`, each `dist/courses/<course>/<learner>.json` and each
  course's clips in `dist/courses/<course>/audio/`.
- Running from source reads the repo's `dist/courses/` and `content/audio/<language>/`.
- Starting and switching as Part 2 describes.

### Browser (`tui-web`)

- The page no longer embeds a course. It fetches `courses/index.json` and the course file in use, so
  it works from a web server (GitHub Pages, `npx serve`) but no longer from a file opened straight from
  disk; the README says so.
- The build copies `dist/courses/` and each course's clips (`courses/<course>/audio/`) into
  `packages/tui-web/dist/`.
- The start dialog lists courses when there is more than one; the games dialog lists the sessions of
  the course being played.
- Switching as Part 2 describes; `WebAudio` gets the clip folder of the course in use.

## Part 5: the changelog

- `CHANGELOG.md` at the repo root, newest first, one `## <version> (<date>)` section per release, in
  plain words for players.
- It starts with every release so far (0.1.0 to 0.12.2).
- `CLAUDE.md` gains the rule: every release adds its entry before the `release:` commit.

## Testing

- **A second test course** in the test fixtures: two scenes, a spaced language (its lines built by the
  test, since the build refuses spaced languages), two readings per word, a second reading language. It
  exercises switching, per-course progress, reading-language switching, tile joining and readings.
- **Build:**
  - the catalog;
  - one file per reading language;
  - aliases;
  - a missing `language-<code>` or `learner-name` fails;
  - `direction: "rtl"` is refused.
- **Saves:** a `zh-china-en` save loads as `zh-china`; folder and key migration keeps every session.
- **Settings:** read and write in the terminal and the browser; bad values are ignored.
- **App** (46 columns):
  - the settings screen;
  - switching course calls `switchTo`, and so does switching reading language;
  - `[o]` is absent without `settings`;
  - spaced tile echo;
  - readings in word help and whole-sentence help.
- **Core:** `replyTiles` with a spaced language.
- **Language-free guard** (Part 3).
- **Chinese unchanged:** the build has no errors, and the bots give the same numbers as 0.12.2.
- **Play-test:** the terminal (pty) and the browser on the built Chinese course, plus a switch to a
  second built course. D1 has only one real course, so the second is the test fixture built into a
  temporary catalog.
- **Review and release:** one Opus review of the whole branch, every finding fixed, then 0.13.0 with
  its changelog entry.

## Not in this slice

- Japanese content (D2).
- A tagger for spaced languages, and right-to-left display.
- Moving the sound setting out of the save.
- The 3D front end (the collaborator's `world3d`), which will need to follow the new course layout
  when it is upstreamed.

## D2, agreed so far (for its own spec)

- **Course `ja-japan`:** Japanese in a new `japan-city` setting, English reading language.
- **The neighbourhood:**
  - a shopping street (商店街);
  - 田中さん on a bench (mentor, greetings and counting);
  - your room and 大家さん;
  - a ラーメン屋 with its owner;
  - a コンビニ.
- **Scenes:** about 9: greeting, name, counting to five, meeting the landlord, rent, meeting the ramen
  owner, the ramen shift (repeatable, paid: water or tea, one to five), and the convenience store
  (prices, then buying).
- **Words:** about 60–80 N5 words, from a hand-written `content/languages/ja/words.json`. Each word has
  kana and romaji readings (Hepburn, long vowels marked), and its conjugated and kana forms as `alt`.
  Particles and です count as words; verbs appear in the polite form; names are bonus words.
- **On screen:** lines in normal kanji and kana; word help shows kana and romaji; the whole-sentence
  help shows romaji.
- **Money:** yen at about 100× the Chinese numbers (start ¥2,000, rent ¥5,000 a week, food ¥500 a
  day, ¥1,000 a job turn). Bot CI rules as for Chinese.
- **Checks:** the Chinese checker rules (at most 2 new words per exchange, replies at most 7 tiles).
  Coverage stays off for the first slice.
- **Your name:** said with さん.
- **Tagging:** a committed snapshot of every Japanese line's split, `お茶|を|二つ|ください|。`, so a
  wrong split shows in review.
- **Voices:** edge-tts has only two Japanese voices (Nanami, Keita). `voices.json` entries may be
  `{ voice, pitch, rate }`; pitch and rate join the clip id only when set, so Chinese ids stay the
  same. The Japanese entries:
  - you: Keita;
  - Tanaka: Keita, lower and slower;
  - the landlord: Nanami, lower;
  - the ramen owner: Keita, higher;
  - the clerk: Nanami.
- **Clips:** in `content/audio/ja/`.
- **Mentor notes:** は vs が, を, です/ます politeness, counting with つ.
