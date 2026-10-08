# Silver Tongue

Language-learning life game. Design: `docs/superpowers/specs/2026-09-25-silver-tongue-design.md`.

## Architecture

```mermaid
flowchart LR
  VE[vendor/vocab-engine pack] -- import:zh --> L[content/languages]
  L --> B[tools: build-course + checker]
  S[content/settings + art] --> B
  LR[content/learner] --> B
  B -- dist/courses/&lt;id&gt;/ --> C[@silver-tongue/core: private package]
  C -- events --> V[packages/view]
  V --> T[packages/tui]
  T --> N[packages/tui-node: terminal + CLI bundle]
  WC[packages/web-common] --> Q
  V --> Q[packages/quiet-web: quiet terminal, the site]
```

- `@silver-tongue/core`: all game rules. `core.send(input) → events`. Closed source: lives in the private repo `Bannerless-Studio/silver-tongue-core` and arrives here as a compiled package (`npm:@bannerless-studio/silver-tongue-core`, GitHub Packages). Test fixtures: `@silver-tongue/core/testing`.
- `packages/tui`: text front end written against the `Terminal` interface. It never keeps game state; everything comes from core events and `core.state`.
- `packages/tui-node`: the Node `Terminal` backend and the `silver-tongue` CLI bundle.
- `packages/view`: presentation logic both front ends share (menus, narration, help cards, notebook, settings, text). Pure: no terminal, no DOM, no I/O.
- `packages/web-common`: browser sessions, settings, audio and course fetching, used by the quiet terminal page.
- `packages/quiet-web`: the quiet terminal page (Preact), forked from the visual novel page (since removed); the only page the site serves; a first visit picks Korean, Chinese or Japanese (`tools/src/site.ts` `SITE_COURSES`), switched later in settings. `quiet.ts` turns core events into transcript lines; the surprisal rules (what the anchor row, glosses and notebook show) live in `packages/view/src/quiet.ts`. Spec: `docs/superpowers/specs/2026-09-28-quiet-terminal-design.md`.
- `tools`: pack import, content build (Fluent → rendered, tagged lines) and the content checker.
- Scenes are language-neutral skeletons that name concepts; each language supplies Fluent lines. Slot values are bound by copying a concept's term under the slot's name (`tools/src/fluent.ts` `bindSlots`).

## Commands

```sh
export GITHUB_PACKAGES_TOKEN=$(gh auth token)   # before npm install/ci: reads the private core package (needs gh auth refresh -s read:packages)
npm test                 # vitest, all packages
npm run typecheck        # tsc
npm run build:course     # content -> dist/courses/<course>/<learner>.json + index.json (fails on any checker error); one course: npm run build:course -- zh-china
npm run learning -- ko-seoul 14 learner   # learning simulator: a bot plays N game days; per-word uses, line familiarity, exchanges with >2 new words (bot "diligent" also takes the daily quick review)
npm run import:syllabus -- ko vendor/korean/pack   # graded word list (A1/A2/B1) -> content/languages/<lang>/syllabus.json, read by the learning report; zh: vendor/vocab-engine/packs/zh (HSK 1/2/3 as A1/A2/B1), ja: vendor/jlpt (N5/N4/N3)
npm run play             # play from source in this terminal
npm run import:zh        # re-import the zh pack from vendor/vocab-engine
npm run audio            # every course (or one: -- zh-china): make missing clips with edge-tts (pipx install edge-tts) + ffmpeg trim, delete unused ones
npm run bundle -w silver-tongue   # build packages/tui-node/dist (a local build; nothing is published to npm any more)
npm run build:quiet      # the quiet terminal page -> packages/quiet-web/dist
npm run build:site       # the site as GitHub Pages serves it: the quiet terminal at /, offering ko-seoul, zh-china and ja-japan
```

## Rules

- Front ends talk to core only through `send` and `state`. Never copy core's source into this repo; a change to the rules is made in `silver-tongue-core`, released there, then picked up here by bumping the `@silver-tongue/core` version in every package that depends on it.
- Always run `npm run build:course` after changing anything under `content/`; never ship a course with checker errors. A changed line needs its clip: run `npm run audio` and commit `content/audio/`.
- Never edit generated files: `content/languages/zh/words.json` (except a word's `attach`), `content/languages/zh/pack.json` (except `stages`, `tileGap`, `book` and `numerals`), `content/learner/en/glosses-zh.ftl`, `content/audio/`, `dist/`. Re-run the import or the build instead.
- `content/learner/<l>/glosses-<lang>-short.ftl` is hand-edited, not generated: curated 1-3 word display glosses for words the short-gloss heuristic (`packages/view/src/help.ts`) can't shorten well on its own. `npm run build:course` warns (without failing) when a stage word has none and needs one.
- A language whose numbers are written as several words lists them in its `pack.json` `numerals` (`chars`, and `pairs` that read their own way: 三百 "sanbyaku"), so a number reads as one ("hyakugojū").
- `content/languages/<lang>/syllabus.json` is generated (`npm run import:syllabus`); `content/languages/<lang>/grammar.json` is hand-written: the level's grammar points, each with a detector (`words` ids or a `pattern`, `{ㄹ}` = any syllable with that final). A point is due by its level's stage (A1 on 1, A2 on 2, B1 on 3) unless it names its own `stage`, used where the story spec's act themes need it later (past tense in act 2). `tools/test/syllabus.test.ts` pins the tricky detectors.
- `npm run build:course` also runs the learning simulator (`tools/src/learning.ts`; it plays until every stage's one-off scenes are done and a week more, at least 14 days) and warns, without failing, on its limits: at most 2 new words per exchange, 85% of lines familiar after the first 10 words, each word used 8 times in the 7 game days after it is first heard, every stage word used, each stage's due grammar points used. A person's name is flagged `"name": true` in the language's word files and never counts as a new word.
- Conversations never branch: every exchange runs in order. A written wrong reply (`<id>-alt<n>`) can have the NPC's own answer (`<id>-alt<n>-answer`, with its meaning in the learner's lines), and the scene's exchange can accept it as a way through (`"alts": { "<n>": { "accept": true, "pay": 0, "loss": 1000 } }`): a lie that works, short change taken. An answer may use only words already met.
- `checks.coverage` in `content/courses/<id>.json` lists the course's finished stages: each of their words must be in 3 scenes. Add a stage once it's written (zh-china: `[1]`; ko and ja stage 1 are still short).
- Two words may share a spelling when one is flagged `"homograph": true` in the language's word files: the tagger takes the other word unless a line marks it, `<spelling>[<id>]` (`{ -item }만[ko-only] 주세요!`). The mark is taken out of the text.
- Bonus (off-list) words go in `content/languages/<lang>/extra-words.json` with glosses in `content/learner/<l>/glosses-<lang>-extra.ftl`.
- Every UI string the TUI uses must be listed in `packages/view/src/text.ts` `UI_KEYS`.
- Every UI string the quiet terminal uses must be listed in `packages/view/src/text.ts` `QUIET_UI_KEYS` (the `vn-` ids among them are from the removed visual novel page).
- Code ported from vocab-engine is used with its author's consent; note the origin in a comment.
- Every release keeps saves of its content: `npm run build:course && npm run saves -- <version>` writes `tools/test/saves/<version>.json`; `tools/test/saves.test.ts` loads every kept release's saves into the current content and plays on.
- Every release adds its `CHANGELOG.md` entry (newest first, `## <version> (<date>)`, plain words for players) before the `release:` commit.
