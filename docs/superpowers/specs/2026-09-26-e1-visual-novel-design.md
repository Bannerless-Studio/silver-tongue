# E1: a 2D visual novel front end

Status: approved in conversation 2026-09-26. Ships as **0.14.0**.

## Goal

A second way to play in the browser: a 2D visual novel. A place is a painted backdrop, the person you
talk to stands in front of it, and their lines appear one at a time in a box along the bottom. It is
the friendlier front end for players who would not use a terminal-style page. The game itself is the
same: the same core, courses, saves and rules as the text game.

- **Look:** flat, hand-written SVG art. Places are coloured illustrations; every character is a
  **faceless silhouette**. The player is never shown (first person).
- **Devices:** phone in landscape and desktop. A phone held upright gets a hint to turn it; the stage
  still plays, letterboxed.
- **Same saves:** the visual novel and the browser text game read and write the same `localStorage`
  sessions, so a game moves between them at any point.
- **Parity:** everything the text game offers: scenes, pick and tile replies, word help, audio, the
  HUD, moving between places, sleeping, the notebook, the mentor and notes, settings (course, reading
  language, sound) and game management (new, list, export, import).

## Packages

```
core ── events/state ──▶ view (new, pure) ◀── tui (uses view; behaviour unchanged)
                              ▲
             web-common (new: sessions, settings, codec, web audio, course fetch)
                 ▲                      ▲
              tui-web               vn-web (new, Preact)
```

### `packages/view`: presentation logic without a screen

Moved out of `packages/tui/src/app.ts` and `notebook.ts`. Pure functions of `(course, state, text)`:
no terminal types, no DOM, no I/O.

- `placeMenu(course, state, t)`: the items offered at a place, in the TUI's order and with its limit
  (talk to each available scene here, the mentor when a note is ready, go to each linked place, sleep),
  each with its `Input`; plus the scenes here that wait only for money, with their cost.
- `helpWords(lastLine, pickOptions, replyMode)`: the words to look up, those of the line first, then
  the other words in the pick options.
- `actionNarration(course, t, action, expected, matched, tilesWrong)`: what the reply did and, on a
  mix-up, what was asked, as lines tagged `plain` or `warn` instead of coloured spans.
- `introLines(course, state, t)`, `hudValues(course, state, t, now)`, `settingsRows(...)` as data
  (label and what choosing it does), `rightReply(course, state)`.
- `notebookEntries(course, state, t, now)`: the notebook as structured data (groups by place, each
  word with its text, reading, gloss, state, first line and clip). `tui`'s `notebookLines` becomes a
  formatter over it.
- `makeText` and `UI_KEYS` move here. `tui` re-exports everything it exported before, so
  `tui-node`, `tui-web` and `tools` keep working without edits.

The TUI's screens and keys do not change. Its existing tests pass unchanged; that is the check that
the move changed nothing.

### `packages/web-common`: browser plumbing shared by both pages

Moved out of `packages/tui-web/src`: `KeyValue`/`fromLocalStorage`, `WebSessions`, web settings and
`migrateWebAliases`, `createWebAudio`, and fetching the catalog and a course. The key names do not
change (`silver-tongue:<course>:session:<id>`, `silver-tongue:<course>:last`,
`silver-tongue:settings`), which is what makes saves shared. The save-line codec stays where Node can
use it too.

### `packages/vn-web`: the visual novel page

- **Preact**, bundled with esbuild into one `dist/index.html` (app, CSS and game-level art inline),
  like `tui-web`. It fetches the catalog, the course and the course's art and clips from `courses/`.
- **Controller (`vn.ts`)**, no DOM, owns only what is being shown, never game state:
  - turns core events into a **beat queue**. Each `lineSpoken`, `lineRephrased`, `npcReacted`,
    narration line, intro line, mentor note and day-end line is one beat;
  - a beat carries its speaker (or none for narration), its line, its clip and a **cue** for the
    silhouette (`speak`, `puzzled`, `pleased`, `listen`);
  - reply choices are offered only once the last beat has been shown;
  - sends inputs to core (`reply`, `replyTiles`, `helpWord`, `goTo`, `startScene`, `visitMentor`,
    `sleep`, `setName`, `setSound`) and saves after each accepted input;
  - keeps the backlog (last 200 lines).
- **Components** read `core.state` and the controller, nothing else.

## The screen

A 16:9 stage, scaled to fit and letterboxed. Layers from back to front:

1. **Background:** the place's SVG; cross-fades on `placeEntered`.
2. **Silhouettes:** in a scene, the NPC stands centred. While exploring, the NPCs with a scene
   available here stand small at their spots; tapping one starts that scene, like its menu item.
   Silhouettes have no faces. They react through motion and a small mark above the head:
   - speaking: a gentle bob while their beat is showing;
   - mix-up (`npcReacted`): a head tilt and a **?** mark;
   - right reply, `sceneEnded`: a small hop and a **!** or **♪** mark;
   - waiting for your reply: still, slightly dimmed.
3. **HUD strip** along the top:
   - day and slot pips;
   - wallet (a `+¥8` / `−¥3` rises on `walletChanged`);
   - rank;
   - a parcel icon during an errand and a "rent late" badge;
   - buttons for sound, notebook, backlog and ☰ (settings, games, "Play as text").
4. **Dialogue box** along the bottom:
   - a nameplate;
   - the line, each word a tappable token, new words underlined;
   - ▶ replay and slow-replay buttons when there is a clip;
   - a **?** for the sentence's meaning when the line has one.

   Narration uses the same box, in italics, with no nameplate.

### Playing

- **Beats:** each beat shows alone and plays its clip; a tap, Space or Enter moves on.
- **Pick replies:** choice buttons stacked in the middle of the stage. The words in them can be
  tapped for help too.
- **Tile replies:** a row of tile buttons above the box, the answer being built inside the box, and
  ⌫ (undo) and ✓ (send) buttons.
- **Word help:** tapping a word opens a card with its reading, gloss and a play button, and sends
  `helpWord`, so help is logged as in the text game. Words can be looked up whenever a line is shown.
- **Exploring:** the box shows the place's description; the choices are the `placeMenu` items: talk
  (with the slot cost), mentor, "go to …" (with an arrow) and sleep. Scenes waiting for money are
  shown greyed out with the reason.
- **Sleeping:** a fade to black, "Day N" and the day-end narration (food, rent), then a fade in.
- **Mentor:** the mentor's silhouette, each note a beat.
- **Name entry:** a real text input in the box, so a phone keyboard opens.
- **Toasts:** a small banner for `unlocked`, `rankChanged`, `noteReady` and a failed save.
- **Overlays** (the stage dims; Esc or ✕ closes):
  - **Notebook:** a paper-style page from `notebookEntries`, grouped by place, a play button per word.
  - **Backlog:** the last 200 lines.
  - **Settings:** course, reading language, sound. Switching course or reading language follows
    the text game's rules (saves first, then continues the chosen course where it was left).
  - **Games:** new game, the games list, export (the `st1:…` line, with Copy) and import.
- **Keys on desktop:** Space/Enter advance; `1`–`9` choices and tiles; Backspace undo a tile; `n`
  notebook; `l` backlog; `o` settings; `m` sound; Esc close.
- **Portrait phone:** a "turn your phone" hint that can be dismissed; the stage stays usable.
- **Title screen:** the logo over the title art, with Continue, New game and the course choice on a
  first visit (the same `chooseStart` rules as the text game).

### Text

Every string the visual novel shows goes in the learner language's `ui.ftl` and is listed with its
variables in `VN_UI_KEYS` (in `view`, beside `UI_KEYS`). The course build fails a learner language
that lacks any of them, as it does for `UI_KEYS`. Place and NPC names reuse `place-<id>` and
`npc-<id>`.

## Art

Art belongs to a **setting**, as places and NPCs do, so another setting brings its own and the
engine stays language-neutral.

- `content/settings/<setting>/art/places/<place>.svg`: one per place, `viewBox="0 0 1600 900"`.
- `content/settings/<setting>/art/npcs/<npc>.svg`: one per NPC, `viewBox="0 0 400 900"`, feet on the
  bottom edge, drawn in `currentColor` so the page tints it.
- `content/settings/<setting>/art.json`: for each place, the silhouette tint and rim-light colour
  that match its light, and the x position (0–1 across the stage) where each of its NPCs stands.
- Game-level art (title, logo) lives in `packages/vn-web/src/art/`.

**Style:**
- flat shapes, a small palette per place, a few layers of depth (sky or wall, mid-ground, foreground);
- silhouettes recognisable by outline and props alone: Old Wang with a cane, the cook in a tall hat,
  the landlord with keys, the foreman in a hard hat, and so on;
- no text in the art: signs are blank shapes or icons, so the art never needs translating and never
  shows words the player has not met.

For china-city that is 12 backgrounds (street, noodle_shop, market, room, warehouse, station_road,
school, hospital, station, shop, tea_house, stairs) and 13 silhouettes (wang, cook, landlord,
foreman, dispatcher, doctor, teacher, traveller, shopkeeper, teaboss, neighbour, classmate, driver),
all written by hand as SVG.

**Build:** `build:course` copies the setting's art and `art.json` into
`dist/courses/<course>/art/`. The page fetches each SVG and inlines it into the DOM, so the tint and
the CSS motion work. The TUI ignores art.

**Checker:** a course with `"checks": { "art": true }` (set for `zh-china`) fails the build if:
- a place or NPC in `world.json` has no SVG or no `art.json` entry;
- an SVG has the wrong `viewBox`, a `<script>`, an `on…` attribute, an external `href` or an
  embedded raster image;
- an SVG is over 40 KB.

**Without art:** a course that has none still plays in the visual novel, with a neutral gradient and
the place name for the background and a generic silhouette for every NPC.

`CLAUDE.md` gets the rule: a new place or NPC needs its SVG and `art.json` entry.

## Hosting

- The Pages workflow builds both pages into one site: the visual novel at `/`, the text game at
  `/text/`, and one shared `/courses/` (catalog, course files, art, clips).
- The visual novel's ☰ has "Play as text"; the text page's header gets a "Visual novel" link.
- The old link now opens the visual novel. Saves carry over because the keys are unchanged; the
  changelog says so.
- `npx silver-tongue` stays the text game.

## Testing

- `view`: unit tests for `placeMenu`, `helpWords`, `actionNarration` and `notebookEntries`. All
  existing `tui` tests pass unchanged.
- `web-common`: the storage, codec and audio tests move with the code.
- `vn-web` controller (no DOM, with core's test helpers):
  - events become beats in order, with the right speaker and cue;
  - replies are offered only after the last beat;
  - a word tap sends `helpWord`;
  - a mix-up gives the `puzzled` cue;
  - a save follows each accepted input, and a failed save shows its toast;
  - switching course or reading language.
- Checker: a missing SVG, a wrong `viewBox`, a `<script>`, an external `href`, a file over 40 KB,
  a missing `art.json` entry.
- A headless smoke test with Playwright, run by hand, not in CI, at a phone-landscape and a desktop
  size:
  - load `/`, get through the intro, pick a reply, open the notebook;
  - reload and continue;
  - open `/text/` and see the same game.

## Order of work

Each step leaves `main` green.

1. Extract `view` from `tui`, behaviour unchanged.
2. Extract `web-common` from `tui-web`.
3. Art pipeline: `art.json`, the build copy and the checker rules, with placeholder SVGs.
4. The visual novel controller and its tests.
5. The Preact page: stage, box, choices, tiles, word cards, overlays, keys, portrait hint, title.
6. The real art: 12 backgrounds and 13 silhouettes.
7. The Pages layout, the cross links, `CHANGELOG.md`, release 0.14.0.

## Left out of E1

- Music and ambient sound.
- Typed replies (not in core yet).
- A portrait-first layout.
- Art made with an image model.
- Any 3D.
- Syncing saves across devices.
- Animated backgrounds (motion is CSS on silhouettes and fades only).
- An npm build of the visual novel.
