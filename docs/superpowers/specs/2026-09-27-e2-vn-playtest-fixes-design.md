# E2: playing the visual novel comfortably

Status: approved in conversation 2026-09-27. Ships as **0.15.0**. Closes #6, #7, #8, #9.

## Goal

Four things a playtest of the visual novel (0.14.0) got in the way. The player should be able to
sit back and let the scene play, hear it slowly enough to copy, and never be confused about what the
buttons on screen want from them.

- **#7** Dialogue waits for a press on every line. It advances by itself, on a timer that gives the
  line time to be read and its clip time to be heard.
- **#8** Clips play at normal speed, so a beginner has to press 🐢 for every line. The default is
  slow, and the speed is the player's to choose.
- **#9** The place menu and the reply options are the same numbered buttons at two sizes, so it is
  not clear which is which. They become two deliberately different things.
- **#6** The intro never says when this is, and never says why you are on your own. It says 1980,
  and why there is no help.

## Playing by itself

**Every beat advances on a timer.** A beat is one line of dialogue, a narration line, the player's
own reply or a mentor note. It shows, it plays its clip, and it moves on by itself. On by default; a
settings row turns it off for a player who would rather press. A tap on the box, Space and Enter all
still jump to the next line at once, exactly as now.

**How long a beat stays.** From the text it shows, not from a flat timer:

| | |
|---|---|
| a line in the language being learned | `900ms + 300ms per word` |
| narration in the reading language | `900ms + 45ms per character` |
| either, clamped to | `1400ms … 7000ms` |

The median line in `zh-china` is 3 words, so 1.8s; the longest is 9, so 3.6s. Reading English
narration at 45ms a character is about 200 words a minute.

**Sound wins.** A beat with a clip is never left before the clip has finished, plus 200ms. At the
new default speed a clip runs about 40% longer than it does now, so the sound is usually what decides
how long a line stays — which is the point, in a game where hearing the line is the lesson. The
controller asks `AudioOut.busy` rather than guessing a clip's length, so nothing is ever cut off
mid-word. `busy` is false when the sound is off, or when the player has muted it.

**Held: the line waits for you.** The timer is not armed, and the beat on screen stays, while:

- an overlay (notebook, backlog, settings, games) or a word card is open;
- the browser tab is in the background, so returning to the tab does not find the scene finished;
- the player is typing their name;
- the beat is the **Day N** card after sleeping. A new day stays a deliberate press.

Un-holding gives the beat that is on screen its full time again, from that moment.

**Never automatic.** The phases that ask a question wait as long as they take: the place menu,
reply options and the tile answer. Auto-advance only ever moves the conversation along.

### Where the timer lives

The controller, not the page: `vn.ts` already owns the beat queue, and a timer next to it is one
place to reason about. It follows the rule the audio layer already uses — time is injected.

- `VnOptions.wait?: (ms, cb) => { cancel(): void }`, defaulting to `setTimeout`, like
  `WebAudioDeps.wait`.
- The timer is armed in `show()`, after the beat's clip is handed to the sound, and is cancelled
  whenever the beat on screen changes — that is, in `advance`, `choose`, `placeTile`, `undoTile`,
  `sendTiles` and `setName`, which all go on to `show()` and arm the next one. A toast appearing or
  being dismissed changes nothing, so it leaves the timer alone.
- When the dwell runs out and the sound is still going, the timer asks again every 200ms until
  `busy` is false, then waits the 200ms pad.
- `Vn.hold(held: boolean)`: true disarms, false re-arms for the beat on screen. `App.tsx` calls it
  with `!!overlay || !!card || document.hidden` (a `visibilitychange` listener for the last).
- With the setting off, no timer is ever armed.
- `AudioOut` gains `readonly busy?: boolean`: true while a clip is playing or queued behind one,
  false after `stop()` and when there is no audio element at all — a page that cannot play sound
  never reports itself busy, so a line with no clip advances on its dwell alone.
  `createWebAudio` and `createNodeAudio` implement it; the controller reads a missing value as
  "not playing".

## Speech speed

**A player preference, `speed`, with three values and a slow default:**

| | rate |
|---|---|
| `slow` (default) | 0.7 |
| `normal` | 0.85 |
| `fast` | 1 |

`Speech.slow` — the NPC repeating itself because you got it wrong — plays at 0.75× the chosen rate
(0.53, 0.64 or 0.75), with 0.5 as a floor it never reaches. The 🐢 button marks the current line slow
under the same rule, so ▶ stays "say it again, at your speed" and 🐢 is always slower than the speed
the player chose. Both press buttons and the notebook's ▶ use the chosen rate; nothing plays at 1
unless the player asks for `fast`.

**Where it is set.** Two rows in the visual novel's settings, after Sound and before Games:

- `Speed: slow` — presses cycle slow → normal → fast → slow.
- `Advance: by itself` — presses toggle between by itself and one press at a time.

`Page` (the interface `main.tsx` hands the page) gains `prefs: { speed: SpeechSpeed;
autoAdvance: boolean }` — already resolved to a value, so `"slow"` and `true` when unset — and
`setPref(patch)` to change one and keep it. The page passes them to `createVn`, which needs both to
know when to arm its timer and nothing else: the rate itself belongs to the audio layer.

**Where it is kept.** `PlayerSettings` in `view/src/choose.ts`, beside `course` and `learner`, in
`silver-tongue:settings`. It is a reading preference, not part of a game, so it is not in a save and
travels to another device with the browser's own storage. The text page reads it too, so both pages
speak at the same speed. The rates live in `view/src/audio.ts`, beside `Speech`, which the terminal
game's player can use as well: `SpeechSpeed`, `SPEEDS` and `playbackRate(speed)`.

**The write has to merge.** Both pages call `saveWebSettings(kv, { course, learner })` when they
remember a course, which replaces the whole object and would wipe `speed` and `autoAdvance` on the
next visit. `web-common` gains `updateWebSettings(kv, patch)`: load, spread, save, return the new
settings. Both `main.tsx` files call that instead; `saveWebSettings` stays for writing a whole
object.

## One kind of button for one job

**Replies are speech.** Reply options stay as they are: big rounded cards over the right of the
stage, the number key in a badge, each word tappable for help. They are what you *say*.

**The place menu is navigation.** "Talk to Old Wang: Meet Old Wang · 1 slot", "→ Go to Noodle Shop",
"Sleep (end the day)" become a compact, dim list low on the right, just above the dialogue box: no
card fill, a hairline rule between items, smaller text, the same number badges so the keys still
read, `→` on travel, greyed out with the reason where it cannot be afforded. It is where you *go*.

The menu stays on the right rather than moving to the left: the NPCs stand left of centre in
`art.json` (x 0.2–0.5), and it shares the band the tile row uses — the two are never on screen
together, because a place menu only appears while exploring and tiles only while answering.

`Choices.tsx` splits into `Replies.tsx` and `PlaceMenu.tsx`, one component each, instead of one
component with a branch. The `kind-…` class goes with it: no rule ever used it.

## The intro

Four lines in `content/learner/en/narration-china-city.ftl`. The year and the joke go first, the
stakes stay, the hook stays last. `$currency`, `$wallet` and `$rent` stay, so the numbers are still
the course's own.

```
intro-1 = China, 1980. There is no phone in your pocket, no translator in your bag, and nobody on this street who speaks your language: whatever you have to say, you will say it in Chinese.
intro-2 = You have { $currency }{ $wallet }. There is a room for you down the street; the rent, { $currency }{ $rent }, falls due at the end of each week, and food costs money every day.
intro-3 = There is work in the noodle shop, at the warehouse, out on the road. It needs words, and words get you paid in full only when you get them right the first time.
intro-4 = On a bench by the road an old man is watching you with open curiosity. Maybe start there.
```

`1980` is written into the setting's own story text, like its place names: china-city is a setting
with a year, and another setting brings its own.

## Text

Every new string goes in `content/learner/en/ui.ftl` and in `VN_UI_KEYS` with its variables, which
the course build checks:

- `vn-speed = Speed: { $speed }`, `vn-speed-slow = slow`, `vn-speed-normal = normal`,
  `vn-speed-fast = fast`
- `vn-advance = Advance: { $mode }`, `vn-advance-auto = by itself`,
  `vn-advance-tap = one press at a time`

## Testing

- `vn-web` controller, with a fake `wait`:
  - a beat advances by itself after its dwell, with no input;
  - a beat whose clip is still playing waits for `busy` to go false, then 200ms;
  - `hold(true)` stops the timer, `hold(false)` gives the beat on screen its dwell again;
  - the **Day N** beat never advances by itself;
  - with the setting off, nothing advances without an input;
  - a manual `advance()` cancels the pending timer (no double advance).
- `vn-web` dwell: the formula and both clamps.
- `web-common` audio: the rate comes from `rate()` on every clip; `slow` is 0.75× and never below
  0.5; `busy` is true from `play()` until the queue drains; a new rate applies to the next clip.
- `view`: `parseSettings` reads `speed` and `autoAdvance` and ignores anything else.
- `web-common` storage: `updateWebSettings` keeps the other fields.
- By hand, in a browser at a desktop size: the two buttons look like two different things; the
  scene plays itself; Settings shows the two new rows and they stick across a reload; the text page
  is at the same speed.

## Order of work

Each step leaves `main` green.

1. `PlayerSettings.speed` / `autoAdvance` in `view`, the speed table in `view/src/audio.ts`,
   `updateWebSettings` in `web-common`, the `busy` member with both players, and the text page
   reading the speed.
2. The controller's timer: `wait`, `hold`, `busy`, the dwell formula, and the settings rows.
3. The two button components and the CSS.
4. The intro rewrite, `npm run build:course`, `CHANGELOG.md`, release 0.15.0.

## Left out

- A typewriter reveal, where the line appears as it is spoken.
- Auto-advance in the text game, which is a page of keys and lists.
- A per-course default speed: one speed for the player, not per course.
- Music, and any sound of its own for the auto-advance.
- A speech speed in the terminal game: `packages/tui-node/src/main.ts` writes the whole settings
  object on every launch, so those two writes have to become a merge before `speed` is stored
  there. Nothing in the terminal game stores one yet.
