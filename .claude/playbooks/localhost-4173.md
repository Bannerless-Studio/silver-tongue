# localhost:4173 (static `site/` build: VN at /, text at /text/, quiet at /quiet/, Korean quiet at /ko/)

## State
- All pages share one origin: `localStorage` keys `silver-tongue:settings` (course, learner, ruby...), `silver-tongue:<course>:meta`, `silver-tongue:<course>:session:<ts>`.
- Clear: `page.evaluate(() => localStorage.clear())` then `page.reload()`. Clearing on one page resets all pages.
- Force a setting: edit JSON in `silver-tongue:settings` (e.g. `ruby: "auto"|"on"|"off"`) then reload.

## Quiet page (/quiet/, /ko/) hotkeys (packages/quiet-web/src/keys.ts)
- `1`-`9` pick option; `?`/`w` reveal line; `n` Book/Notebook; `s` status; `o` settings; `m` sound; `r` replay; `Escape` closes overlay.
- Overlay keys are ignored while an overlay is open: press `Escape`, wait ~300ms, then the next hotkey (Escape+`o` back-to-back drops the `o`).
- Start: button `New game` -> textbox (name) -> button `That's me` (or Enter).
- /quiet/ with cleared storage shows picker buttons `1 Japanese`, `2 Korean`, `3 Chinese`. /ko/ skips the picker.

## Selectors / anchors (quiet)
- Transcript: `[role=log]` children. NPC line `div.ln.npc` (`.who`, `.line` with `button.w` words), gloss rows `div.gl` ("┆ 민준 minjun · Min-jun (new)").
- Options: `main button` whose innerText starts with a digit; `.prompt button.opt`. Strip `rt` before matching text (ruby text is inlined in innerText: "네ne?").
- Readings are `<ruby><rt>`: count `main rt`. First-time glossed words get no ruby in the transcript (reading is in the gloss row); options always carry ruby in auto.
- A finished scene collapses to "✓ <scene> · <npc>" so its rt disappear; test readings on a live scene.
- Overlays: `[role=dialog]` named "Book" (ko) / "Notebook" (zh, ja) / "Settings" / "Status". Book tabs via `getByRole('tab', {name: 'Letters'|'Papers'})`; papers `.nb-paper` (expands `.paper-body`).
- Letter buttons named like `ㄱ 기역 g/k`; tapping fetches `/courses/ko-seoul/audio/<hash>.mp3`.
- Settings row `Readings under words: new words only|always|never` (ko only; button, click cycles).
- Top bar `[role=banner]`: "<place> · Day N, <part>". `setting-where` ("Seoul, 2000") is not shown on the quiet page.

## Visual novel (/)
- Only courses with `art/art.json` are offered (zh-china only); it probes ko/ja art.json and logs two 404 console errors per load. Expected noise, not a regression.
- Advance with button `Tap to continue`; top buttons `Sound`, `Notebook`, `What was said`, `Menu` (Menu opens Settings dialog).

## Gotchas
- Playwright MCP screenshots may only be written under the repo (`.playwright-mcp/...`); copy out and delete that dir after.
- Wrong replies loop: the NPC repeats slower; don't press the same wrong number in a loop.
- korean room-wake right replies: 네? / 아니요. / 민준 씨 방? / 저는 <name>입니다. / 안녕히 가세요.
- Playwright MCP `page.screenshot({path})` via browser_run_code_unsafe writes anywhere (e.g. scratchpad); only browser_take_screenshot is repo-bound.
- Clearing: after navigating from a game page, clear+reload once can leave `silver-tongue:settings` re-written with the old course (picker skipped). Clear+reload twice, then check for the picker.
- /ko/ (book course): no gloss rows; NPC line words are `ruby > button.w` + `rt` "reading · gloss" while onboarding (<10 words heard), reading only after. Only the latest NPC line has `button.q`. Later NPC lines in a scene have no `.who`.
- VN fresh underline (`.word.fresh`) exists only during the line's beat (box shows line, buttons `Say it again|Say it slowly`); once options appear the same line re-renders without `.fresh`. Check before tapping past.
- art.json 404s (ko-seoul, ja-japan) come from the VN page only; /ko/ and /quiet/ log none.
- ko street-hello right replies: 안녕하세요. / 박 할아버지, 안녕하세요. / 저는 <name>입니다. / 감사합니다. / 아니요, 몰라요. Match options by text with `rt` stripped (order shuffles).
