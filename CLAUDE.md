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
  V --> VN[packages/vn-web: visual novel]
  T --> N[packages/tui-node: terminal + CLI bundle]
  T --> W[packages/tui-web: text page]
  WC[packages/web-common] --> W
  WC --> VN
  V --> Q[packages/quiet-web: quiet terminal]
  WC --> Q
```

- `@silver-tongue/core`: all game rules. `core.send(input) → events`. Closed source: lives in the private repo `Bannerless-Studio/silver-tongue-core` and arrives here as a compiled package (`npm:@bannerless-studio/silver-tongue-core`, GitHub Packages). Test fixtures: `@silver-tongue/core/testing`.
- `packages/tui`: text front end written against the `Terminal` interface. It never keeps game state; everything comes from core events and `core.state`.
- `packages/tui-node`: the Node `Terminal` backend and the `silver-tongue` CLI bundle.
- `packages/view`: presentation logic both front ends share (menus, narration, help cards, notebook, settings, text). Pure: no terminal, no DOM, no I/O.
- `packages/web-common`: browser sessions, settings, audio and course fetching, shared by the web pages.
- `packages/vn-web`: the visual novel page (Preact). `vn.ts` turns core events into beats; components only draw.
- `packages/quiet-web`: the quiet terminal page (Preact), forked from vn-web. `quiet.ts` turns core events into transcript lines; the surprisal rules (what the anchor row, glosses and notebook show) live in `packages/view/src/quiet.ts`. Spec: `docs/superpowers/specs/2026-09-28-quiet-terminal-design.md`.
- `tools`: pack import, content build (Fluent → rendered, tagged lines) and the content checker.
- Scenes are language-neutral skeletons that name concepts; each language supplies Fluent lines. Slot values are bound by copying a concept's term under the slot's name (`tools/src/fluent.ts` `bindSlots`).

## Commands

```sh
export GITHUB_PACKAGES_TOKEN=$(gh auth token)   # before npm install/ci: reads the private core package (needs gh auth refresh -s read:packages)
npm test                 # vitest, all packages
npm run typecheck        # tsc
npm run build:course     # content -> dist/courses/<course>/<learner>.json + index.json (fails on any checker error); one course: npm run build:course -- zh-china
npm run learning -- ko-seoul 14 learner   # learning simulator: a bot plays N game days; per-word uses, line familiarity, exchanges with >2 new words
npm run play             # play from source in this terminal
npm run import:zh        # re-import the zh pack from vendor/vocab-engine
npm run audio            # every course (or one: -- zh-china): make missing clips with edge-tts (pipx install edge-tts) + ffmpeg trim, delete unused ones
npm run bundle -w silver-tongue   # build packages/tui-node/dist (a local build; nothing is published to npm any more)
npm run build:vn         # the visual novel page -> packages/vn-web/dist
npm run build:quiet      # the quiet terminal page -> packages/quiet-web/dist
npm run build:site       # all three pages into site/, as GitHub Pages serves them (visual novel at /, text game at /text/, quiet terminal at /quiet/)
```

## Rules

- Front ends talk to core only through `send` and `state`. Never copy core's source into this repo; a change to the rules is made in `silver-tongue-core`, released there, then picked up here by bumping the `@silver-tongue/core` version in every package that depends on it.
- Always run `npm run build:course` after changing anything under `content/`; never ship a course with checker errors. A changed line needs its clip: run `npm run audio` and commit `content/audio/`.
- Never edit generated files: `content/languages/zh/words.json` (except a word's `attach`), `content/languages/zh/pack.json` (except `stages`, `tileGap` and `book`), `content/learner/en/glosses-zh.ftl`, `content/audio/`, `dist/`. Re-run the import or the build instead.
- `content/learner/<l>/glosses-<lang>-short.ftl` is hand-edited, not generated: curated 1-3 word display glosses for words the short-gloss heuristic (`packages/view/src/help.ts`) can't shorten well on its own. `npm run build:course` warns (without failing) when a stage word has none and needs one.
- Bonus (off-list) words go in `content/languages/<lang>/extra-words.json` with glosses in `content/learner/<l>/glosses-<lang>-extra.ftl`.
- Every UI string the TUI uses must be listed in `packages/view/src/text.ts` `UI_KEYS`.
- Every UI string the visual novel uses must be listed in `packages/view/src/text.ts` `VN_UI_KEYS`.
- Every UI string the quiet terminal uses must be listed in `packages/view/src/text.ts` `QUIET_UI_KEYS` (strings it shares with the visual novel stay in `VN_UI_KEYS`).
- A new place or NPC needs its drawing (`content/settings/<setting>/art/places|npcs/<id>.svg`) and its `art.json` entry. Characters are faceless silhouettes in `currentColor`; no text in art. Ids inside a drawing start with its file name.
- Code ported from vocab-engine is used with its author's consent; note the origin in a comment.
- Every release adds its `CHANGELOG.md` entry (newest first, `## <version> (<date>)`, plain words for players) before the `release:` commit.
