# Milestone B1: game features and course bots

2026-09-25 · status: approved in conversation ("Start B1"), written up for review

B is split into four releases: **B1** game features and bots, **B2** browser TUI, **B3** full stage-1 content, **B4** audio. B1 uses only the pilot content (Old Wang's lesson and the noodle shop) and ships as `silver-tongue@0.4.0`. The main design is `2026-09-25-silver-tongue-design.md`; this document covers what B1 adds.

## 1. Narrated actions

The player's reply is an action, and the game now says what happened instead of only "That's not what they asked for".

- `actionPerformed` gains `expected: Record<string, string>`: the action the NPC asked for, with slots resolved. `action` stays what the player's reply did. (This only adds a field, so C isn't broken.)
- The build gives the course `conceptNames: Record<concept, string>`, each concept's base form from `learner/<l>/terms.ftl`, e.g. `tea → "tea"`.
- Narration messages, all optional, in `narration-<setting>.ftl`:
  - `action-<name>`: what happened. Variables: the action's parameters, with concept values given as learner names. Example: `action-serve = You set down { $count } cups of { $item }.`
  - `asked-<name>`: what was asked, shown only on a mismatch. Example: `asked-serve = The cook wanted { $count } cups of { $item }.`
- The TUI shows `action-<name>` after every reply that has one. On a mismatch it shows `asked-<name>` if there is one, and otherwise falls back to the generic `mismatch` line.
- Pilot content gets narration for `fetch` and `serve`, the noodle-shop actions. Greetings have none, because Old Wang's reaction says enough.

## 2. Notebook (`n`)

- `WordRecord` gains an optional `first: { line: string; place: string }`, set the first time the word is seen in a spoken line. Old saves stay valid (the field is optional; `SAVE_VERSION` stays 1).
- The build gives the course `stageWords: Record<stage, WordId[]>`: every pack word on each stage's levels. That's the "stage word list" progress counts toward. It's ids only, so it stays small.
- The view is reachable from the menu and in conversation. It costs no time.
  - Header: `Stage 1: 5 of 150 words known · 12 met`.
  - Words the player has seen, grouped by the place they were first heard. Each line: state mark (`●` known, `◐` shaky, `○` met), word, pronunciation, gloss, first line.
  - Then **Notes**: the mentor notes already read, as title and text.
  - `↑`/`↓` scroll. `esc` or `n` closes it.

## 3. Mentor: Old Wang

Old Wang already teaches on the bench, so he is the mentor. There's no separate neighbour.

- The world gains `mentor: { npc: "wang", after: "street-hello" }`. Once `after` is done, the menu at his place offers "Ask Old Wang about the language (1 slot)".
- `languages/zh/notes.json` holds `[{ "id": "bei", "trigger": { "word": "x0001" } }, { "id": "hao-ma", "trigger": { "scene": "noodle-intro" } }, …]`. A `word` trigger fires when the word has been seen; a `scene` trigger fires when the scene is done.
- `learner/en/mentor-zh.ftl` holds `note-<id>-title` and `note-<id>`.
- Core:
  - `GameState` gains optional `notes: { ready: string[]; read: string[] }`.
  - After each accepted input, triggered notes that are neither ready nor read become ready, and `noteReady { note }` is emitted.
  - New input `visitMentor`. It needs no running scene, the mentor's place and a free slot. It costs one slot and emits `mentorVisited { npc, notes }` with the ready notes in order, which then count as read. With nothing ready, `notes` is `[]`.
  - New reject reasons: `no-mentor` for the wrong place or before `after`. Otherwise the existing `in-scene` and `no-slots` apply.
- TUI:
  - `noteReady` shows a hint: "Old Wang looks like he has something to tell you."
  - `mentorVisited` shows each note's title and text, or `mentor-nothing` when there's none.
- Pilot notes, three of them:
  - 不客气 means "don't be polite" (after street-hello).
  - 好 alone agrees, and 吗 makes a question (after noodle-intro).
  - 杯 is a measure word (when 杯 is first seen).
- Checker: note triggers name known words and scenes, ids are unique, every note has a title and text in the learner file, and `mentor.npc` and `mentor.after` exist.

## 4. TUI polish

- Menu items that cost a slot (talking, the mentor) end with `· 1 slot`.
- When rent is late, the HUD ends with `· rent due`.
- A save that won't parse is backed up as `<name>.json.invalid-backup`. If that name is already taken, a timestamp is added, so an older backup is never replaced.

## 5. Saves: export, import, play-test log

- `npx silver-tongue --export` prints the last-played session as one base64 line of the save JSON. `--resume` style picking isn't needed: export the one you'd continue.
- `npx silver-tongue --import <line>` checks the line strictly (base64, JSON, `parseSave`) and saves it as a **new session**. Nothing is overwritten, so no backup is needed. On failure it prints the reason and exits 1.
- `GameState` gains optional `log: { t: number; day: number; slot: number; input: Input }[]`. The core appends each accepted input and keeps the last 500. There is no analytics service, and the log goes wherever the save goes.

## 6. Course bots

`npm run bots [course]` runs scripted players against the real core, with a seeded random source and a fake clock that advances an hour per input. The players:

| Bot | Replies |
|---|---|
| `right` | always right |
| `wrong` | always wrong while a wrong reply exists, then right |
| `random` | random |
| `learner` | right 70% of the time |

- Every bot follows the same plan: visit the mentor when a note is ready; start an available scene here; else walk to the nearest place with one; else sleep.
- A bot may read the run's expected combo to answer; bots are test code.
- Each bot plays 14 game days.
- Report per bot:
  - the day each one-off scene was first finished;
  - the lowest and highest wallet;
  - days spent with no scene available anywhere (dead ends);
  - notes read, words met and words known at the end.
- Hard checks, as a Vitest test on the real course in CI:
  - `right` finishes every one-off scene;
  - no bot hits a dead end;
  - every bot that is out of money still has a paying repeatable scene available.
- Pacing targets (gate in ~7 days) wait for B3.

## Contract changes (core)

These are additive only:
- `Input.visitMentor`;
- the events `noteReady` and `mentorVisited`;
- `actionPerformed.expected`;
- `REJECT_REASONS += "no-mentor"`;
- `GameState.notes?` and `GameState.log?`;
- `WordRecord.first?`;
- `Course.conceptNames`, `Course.stageWords`, `Course.notes` and `World.mentor?`.

## Left out of B1

- Typed replies: the zh pack has no typing.
- `wordOpts` distractors, including a second option for one-reply exchanges (B3).
- The room, the landlord and where you sleep (B3 content).
- Teaching numbers before the noodle shop (B3 content).
- The punctuation in the tile-reply echo.
- The browser TUI (B2) and audio (B4).
