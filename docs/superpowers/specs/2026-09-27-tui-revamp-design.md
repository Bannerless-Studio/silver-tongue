# TUI revamp: panels, fading readings, a real notebook

Status: approved in conversation 2026-09-27. Branch `tui-revamp`, off `main`.

## Goal

The text game (`packages/tui`, drawn by `tui-node` in a terminal and by `tui-web` in xterm.js) is
one frame: a scrolling log, a prompt and a line of key hints. It works, but everything looks the same
weight, a looked-up word is buried in the log, and the notebook is one long scroll.

This pass restyles it after the "terminal UI concepts" mockup, using **only mechanics the game has
today**. No rule changes, no core release of its own. What the mockup shows that core cannot do yet
is out of scope and gets its own spec later:

- typed replies (pinyin or characters) with graded hints (mockup 03)
- timed jobs with steps (mockup 04)
- review quizzes (mockup 05)
- an "objective" line in the HUD (core has no objectives)
- the notebook's Phrases and People tabs, and topic categories like Food or Work (no data for them)

Everything stays language-neutral: the same layout serves zh (pinyin) and ja (kana), and every
string goes through the learner's Fluent text.

## Layout: a stack of panels

`screen.ts`'s single frame (`renderScreen`) is replaced by `panel.ts`: a screen is a stack of
bordered panels, each with a title and an optional right-hand label, joined by `├─┤` rules.

```
┌ Noodle Shop ───────────── Day 1 · slot 2/4 ┐   header: place, day and slot
│ ¥300   Rent in 6 days   Speaks: Pidgin     │   HUD row
├────────────────────────────────────────────┤
│ 老板: 有 牛肉面，也有 鸡蛋面。                │   log; first-time words cyan underline
│       yǒu niúròumiàn, yě yǒu jīdànmiàn      │   reading row (see below)
│ You: 我要一碗牛肉面。                        │
├ 牛肉面 niúròumiàn ─────────────────────────┤   word card, only after a lookup
│ beef noodle soup                            │
├ Your reply ────────────────────────────────┤
│ 1) 我要一碗牛肉面。  — I'd like beef noodles │
│ 2) 多少钱？          — how much?             │
└ [1-3] reply · [w] help · [n] notebook ── Silver Tongue v0.17.0 · by Bannerless Studio ┘
```

- **Header.** Place on the left of the top border, day and slot on the right.
- **HUD row.** Money, days until rent, rank, and the parcel marker while an errand is on. Rent
  turns red when it is late. Days until rent is `7 - day % 7` (rent falls on every 7th day, see
  core `life.ts`), computed in `view/hud.ts` as `rentInDays`; the HUD string moves into its own Fluent
  keys (`hud-top`, `hud-row`) so it can be laid out in two places.
- **Log.** Takes every row the other panels leave, newest at the bottom, as now.
- **Word card panel.** Looking a word or the whole sentence up with `[w]` opens the card in its own
  panel instead of pushing a line into the log. It stays until the next reply, another lookup, or
  `Esc`. Text, reading, base form when it differs, and the full gloss.
- **Reply panel.** Titled "Your reply" in a scene and "What now?" when exploring. Numbered options as
  now; a pick reply keeps its meaning while any of its words isn't known (unchanged rule). Tiles,
  help's word list, settings and the name prompt all draw into this same panel.
- **Footer.** Key hints on the left of the bottom border, credit and sound state on the right.

### Fitting small screens

`tui-web` runs on phones, so every screen must work at 40×12.

- Under 50 columns: the HUD row wraps, reply meanings go on their own dim line under the reply, and
  panel side borders are dropped (rules only).
- Rows are handed out in this order: header, footer, reply panel, HUD row, word card, log. The log
  gets what is left, at least one row; when even that doesn't fit, the word card closes, then the HUD
  row goes.
- CJK and kana are two columns wide; no line is ever cut through a wide character (`width.ts` already
  does this).

## Readings fade with memory

Under an NPC line (said or rephrased) a dim yellow row gives its reading: pinyin for zh, kana for ja,
each word's last reading as `sentenceCard` already builds it. The row shows only while the line has
at least one word that isn't `known`; once every word is known, the line stands alone. The rule
lives in `view` (`readingRow(course, state, line, now)`, returning the text or `undefined`) so the
visual novel can use it later. The first-time gloss row stays, below the reading.

## Credit

"by Bannerless Studio" is a new Fluent key `credit` (listed in `UI_KEYS`), so "by" can be translated.

- **Bottom right**, where the version already is. As the screen narrows it steps down:
  `<sound> · Silver Tongue v<v> · by Bannerless Studio` → `<sound> · Silver Tongue v<v>` →
  `<sound> · v<v>` → `<sound>`. The key hints on the left always win.
- **Arrival.** Above the intro story in the log, "Silver Tongue" in bold and the credit dim under it,
  so a phone that has no room in the border still sees it once.

## Notebook

```
┌ Notebook ──────────────────────────── Speaks: Pidgin ┐
│ [Words]  Notes                  Stage 1: 12/40 known │
├──────────────┬───────────────────────────────────────┤
│ ▸ Recent  (3)│ 牛肉面 niúròumiàn            new      │
│   Noodle Shop│   beef noodle soup                    │
│   Street  (8)│ 多少钱 duōshao qián     ■■□□□  met    │
│   Home    (5)│   how much                            │
└ [tab] tab · [←→] group · [↑↓] word · [enter] open · [p] play · [esc] back ┘
```

- **Tabs:** Words and Notes (the mentor notes already explained). `[tab]` switches.
- **Left column (Words):** Recent first, then one group per place in world order (the existing
  groups, `notebookEntries`). `[←→]` moves between groups. Recent is the words first heard within the
  last day of play (`firstSeen >= now - DAY_MS`); it is left out when empty.
- **Right column:** each word's text, reading, short gloss, a five-cell memory bar and a label. The
  bar fills `min(streak, 5)` cells. The label is `new` at streak 0, else the word state: `met`,
  `shaky` (yellow), `known` (green). `[↑↓]` moves the selection (`▸`), `[enter]` expands it to show
  the line it was first heard in, `[p]` plays its clip.
- **Under 50 columns:** one column; the group list becomes a single line `◂ Noodle Shop (8) ▸`.
- **Data in `view`:** `notebookEntries` gains the Recent group and, per word, `bar` (0-5) and
  `label`. `tui/notebook.ts` only draws.

## Colours

The 16 standard ANSI colours only, no background fills, so the player's terminal theme holds and a
light background stays readable. `Color` gains `blue` and `white` (`ansi.ts` 34, 37).

| Role | Style |
|---|---|
| Borders and rules | dim |
| Panel titles | cyan bold |
| NPC names | cyan bold |
| The player's name/"You" | green bold |
| Words heard for the first time (the rule as now) | cyan underline |
| Readings | yellow dim |
| Money in, known, unlocked | green |
| Money out, late rent, rejected input | red |
| Shaky words, mix-ups, warnings | yellow |
| Glosses, narration, the credit | dim |
| Selected row | bold, `▸` marker |

## Code

- `packages/view`: `rentInDays` in `hud.ts`; `readingRow`; notebook Recent group, `bar` and
  `label`; new keys (`credit`, `hud-top`, `hud-row`, `notebook-tab-*`, `notebook-recent`,
  `notebook-label-*`, `reply-title-explore`, key hints) in `ui.ftl` and `UI_KEYS`.
- `packages/tui/src/panel.ts` (new): `Panel { title?, right?, lines, min?, max? }` and
  `renderPanels(header, panels, footer, cols, rows)`, which does the row budget and the narrow mode.
  `screen.ts` keeps `lineSpans` and `wrapItems`; `renderScreen` goes.
- `packages/tui/src/app.ts`: builds panels instead of a `ScreenModel`; keeps all game handling as is.
  The word card becomes app state (`card`), cleared on reply, lookup or `Esc`.
- `packages/tui/src/notebook.ts`: the two-column notebook, with tab, group and selection state kept
  in `app.ts`.
- The `Terminal` interface is unchanged, so `tui-node` and `tui-web` need nothing but the new colours
  in `ansi.ts`.

## Testing

- `test/panel.test.ts`: every frame is exactly `cols × rows` (by `strWidth`); the row budget order;
  narrow mode below 50 columns; the credit's four steps.
- Every mode (explore, pick, tiles, help, word card, notebook Words and Notes, settings, name) drawn
  at 40×12, 80×24 and 120×40: no line overflows, no wide character is cut, the key hints show.
- `app.test.ts`: behaviour tests keep passing; assertions that pinned the old frame are updated.
- `view` tests: `rentInDays` across the week and when late, `readingRow` shown then hidden as words
  become known, the Recent group, `bar` and `label` for each word state.
- A zh and a ja course fixture both drawn, so readings and widths are checked for pinyin and kana.
- Each commit: `npm test`, `npm run typecheck`. At the end: `npm run play` at 80 columns and
  `npm run build:site` with the text page at phone width.

## Commits

1. `view`: rent countdown, reading rule, notebook data, new strings.
2. `tui`: `panel.ts`, its tests, the two new colours.
3. `tui`: play screens on panels (HUD, log, word card, reply panel, credit in the footer).
4. `tui`: the notebook.
5. `tui`: arrival title and credit.

## Release

No change to core. It still ships a release, since core and silver-tongue always release at the
same version: whichever minor is next when this merges (0.17.0 if it lands before D2, which has
claimed 0.17.0; otherwise 0.18.0), with a `CHANGELOG.md` entry in plain words.
