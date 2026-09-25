# Milestone B1: Game Features Implementation Plan

> Spec: `docs/superpowers/specs/2026-09-25-b1-game-features-design.md`. Branch `milestone-b1`; push after every task. Each task is test-first (Vitest), ends with `npm run typecheck && npm run build:course && npm test` green, and is committed with the session trailers. A review agent checks each task's diff before the next starts.

**Goal:** narrated actions, the notebook, Old Wang as mentor, TUI polish, save export/import with a play-test log, and course bots. Release `silver-tongue@0.4.0`.

**Architecture:** core changes stay additive (`Input`/`GameEvent` are a contract for C). New content is optional in saves (`SAVE_VERSION` stays 1). The TUI reads everything from the built course and learner Fluent text.

## Tasks

### Task 1: core contract, action expectations, play-test log, first-heard lines
- `packages/core/src/types.ts`:
  - `actionPerformed.expected`;
  - `WordRecord.first?: { line: string; place: string }`;
  - `GameState.log?: LogEntry[]` (`{ t, day, slot, input }`);
  - `Course.conceptNames`, `Course.stageWords`, `Course.notes: Note[]` (`{ id, trigger: { word } | { scene } }`);
  - `World.mentor?: { npc, after }`;
  - `GameState.notes?: { ready, read }`;
  - the `visitMentor` input, the `noteReady` and `mentorVisited` events, and reject `no-mentor`.
- `dialogue.ts`: `resolve` emits `expected` (`resolveParams(ex.expect, run.combo)`). `speak` and the rephrase set `first` on words that don't have it.
- `core.ts`: append accepted inputs to `log`, capped at `LOG_LIMIT = 500`.
- `save.ts`: validate the optional `notes`, `log` and `first` when present.
- Fixture: `conceptNames`, `stageWords`, `notes: []`.
- Tests:
  - `expected` on a match and a mix-up;
  - `first` is set once and never overwritten;
  - the log caps at 500 and skips rejected inputs;
  - saves with and without the new fields load, and malformed ones are rejected.

### Task 2: mentor notes in the core
- `packages/core/src/mentor.ts`:
  - `readyNotes(course, state)`: triggers met, neither ready nor read;
  - `visitMentor(ctx)`.
- `core.ts`: after each accepted input, mark newly triggered notes ready and emit `noteReady`. Handle `visitMentor`.
- `life.ts` / `availableSceneIds` unchanged. Add `mentorAvailable(course, state)` for the TUI menu.
- Tests:
  - word and scene triggers;
  - ready once;
  - a visit costs a slot, returns the ready notes in course order and marks them read;
  - an empty visit;
  - rejects: `no-mentor` (wrong place, before `after`, or no mentor), `in-scene`, `no-slots`.

### Task 3: build and content
- `tools/src/build-course.ts`:
  - `conceptNames` from `learner/<l>/terms.ftl` (render `{ -<concept> }`);
  - `stageWords` from the pack levels;
  - `notes` from `languages/<lang>/notes.json` (optional file);
  - mentor text in `learnerFtl` (`mentor-<lang>.ftl`).
- `tools/src/check.ts`:
  - every concept has a learner name;
  - note ids are unique and triggers name known words and scenes;
  - each note has `note-<id>` and `note-<id>-title`;
  - `mentor.npc` and `mentor.after` exist.
- Content:
  - `world.json` gets `mentor`;
  - `notes.json` gets 3 notes;
  - `mentor-zh.ftl`;
  - narration gets `action-fetch`, `action-serve`, `asked-fetch`, `asked-serve`, `note-hint`, `mentor-*`.
- Tests: the real course builds with `conceptNames.tea === "tea"`, `stageWords["1"]` holds 150 ids, and there are 3 notes. Broken content triggers each new checker error.

### Task 4: TUI (narration, mentor, polish)
- `app.ts`:
  - after `actionPerformed`, narrate `action-<a>` (concept values → `conceptNames`); on a mismatch, `asked-<a>` or else `mismatch`;
  - `noteReady` → hint;
  - the menu gets the mentor item when `mentorAvailable`;
  - `mentorVisited` → notes or `mentor-nothing`;
  - `· 1 slot` on talk and mentor items;
  - `· rent due` in the HUD when `rentLate`.
- `text.ts`: new `UI_KEYS` (`cost-slot`, `hud` with `rentDue`, `menu-mentor`, `mentor-nothing`, `note-hint`, `notebook-*`, `keys-notebook`).
- Tests with the fixture: narration on a match and a mismatch, the fallback, the mentor menu and visit, the slot marks, rent due.

### Task 5: notebook view
- `packages/tui/src/notebook.ts`: `notebookLines(course, state, t, now)` returns the header, the place groups and the notes.
- `app.ts`: mode `notebook`, `n` from explore or scene, `↑`/`↓` scroll, `esc`/`n` back. The footer uses `keys-notebook`.
- Tests: the header counts, grouping by place, state marks, read notes listed, scrolling, and back to the previous mode.

### Task 6: tui-node (backups, export, import)
- `storage.ts`: backups never replace an older `.invalid-backup` (timestamp suffix).
- `cli.ts`: the flags `--export` and `--import <line>`, plus `encodeSave`/`decodeSave` (base64 of the JSON, strict).
- `main.ts`: export prints the last session (or "no saved games", exit 1). Import writes a new session and prints its summary line.
- Tests: the backup suffix, the export/import round trip, and a bad line (not base64, not JSON, the wrong course) giving a reason.

### Task 7: course bots
- `tools/src/bots.ts`:
  - `runBot(course, policy, { days, seed })` returns a report;
  - the four policies;
  - a `main` that prints a table.
- Root `package.json`: `"bots": "tsx tools/src/bots.ts"`.
- `tools/test/bots.test.ts` runs on the real built course. `right` finishes every one-off scene, no bot has a dead end, and no bot is broke without a paying repeatable scene.

### Task 8: docs and release
- README keys (`n` notebook), the spec's open "left out" list, and the version `0.4.0`.
- Final whole-branch review (opus), fixes, then merge `milestone-b1` to main and let CI publish. Play-test the release from `--new`.
