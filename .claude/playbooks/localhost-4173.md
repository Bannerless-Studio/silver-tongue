# localhost:4173 (static `site/` build: VN at /, text at /text/, quiet at /quiet/, Korean quiet at /ko/)

## State
- All pages share one origin: `localStorage` keys `silver-tongue:settings` (course, learner, ruby...), `silver-tongue:<course>:meta`, `silver-tongue:<course>:session:<ts>`.
- Clear: `page.evaluate(() => localStorage.clear())` then `page.reload()`. Clearing on one page resets all pages.
- Force a setting: edit JSON in `silver-tongue:settings` (e.g. `ruby: "auto"|"on"|"off"`) then reload.

## Quiet page (/quiet/, /ko/) hotkeys (packages/quiet-web/src/keys.ts)
- `1`-`9` pick option; `?`/`w` reveal line; `b` Book (ko) / `n` Notebook (zh, ja); Enter does the place's bright control `button.next-btn.only` (ko: any menu; desk: opens the bright card); `s` status; `o` settings; `m` sound; `r` replay; `Escape` closes overlay.
- Overlay keys are ignored while an overlay is open: press `Escape`, wait ~300ms, then the next hotkey (Escape+`o` back-to-back drops the `o`).
- Start: zh/ja: button `New game` -> textbox (name) -> `That's me`. ko (/ko/): crawl (wait ~15s for `.crawl-screen .go`, Enter) -> `.name-screen` input (autofocused; type + Enter works) -> desk (Enter opens `.desk-card.next`) -> knock (Enter).
- /quiet/ with cleared storage shows picker buttons `1 Japanese`, `2 Korean`, `3 Chinese`. /ko/ skips the picker.

## Selectors / anchors (quiet, /ko/ book stage) — Stage.tsx, spec 2026-09-29 §12
- Layout: `main.stage-wrap` > `.history` (one row per utterance: `.h-row.h-their` / `.h-row.h-mine` with `button.h-say`, notes `.h-note`), `section.stage-now` (`.direction-row .direction`, `.their.hue-N` > `.who` (name only on a scene's first line / change; `.tag` "again, slower" on a repeat) > `.say` > `.say-text` (Line with `ruby > button.w` + `rt`) + `button.q`; `.say-mean`; `.hint`), `.said-row .said` (your said line), `.their.reaction` (their reaction to a miss), `.word-paper` (word card), then `.replies`.
- Replies: `.slips > button.slip` (`.slip-text`, `.slip-rd`, `.slip-mean`; `.slip-n` number only without touch; `.slip.tried` = missed, drawn last; number keys follow the drawn order). `button.say-nothing` = look confused. Tiles: `.pieces .tiles button.tile.piece` (+`.pieces .hint` once), built line `.said-row.building` with `.bt.undo` / `.bt.send`.
- Between scenes: `section.stage-now.loose` (directions centred) and `.replies .prompt button.next-btn.only` (+`.also`).
- Holds: after a right pick the said line stays ~1.1 s before their answer (slips hidden); a scene opening shows its direction alone ~1.2 s. Any key or tap on `main` skips a hold (and does nothing else). Wait ~1.4 s after a pick before reading slips.
- Reload mid-game shows the title (`Continue`); a resumed game between scenes is a menu (no knock screen).

## Selectors / anchors (quiet, /quiet/ zh/ja transcript)
- Transcript: `[role=log]` children. NPC line `div.ln.npc` (`.who`, `.line` with `button.w` words), gloss rows `div.gl` ("┆ 민준 minjun · Min-jun (new)").
- Options: `main button` whose innerText starts with a digit; `.prompt button.opt`. Strip `rt` before matching text (ruby text is inlined in innerText: "네ne?").
- Readings are `<ruby><rt>`: count `main rt`. First-time glossed words get no ruby in the transcript (reading is in the gloss row); options always carry ruby in auto.
- A finished scene collapses to "✓ <scene> · <npc>" so its rt disappear; test readings on a live scene.
- Overlays: `[role=dialog]` named "Book" (ko) / "Notebook" (zh, ja) / "Settings" / "Status". Book tabs via `getByRole('tab', {name: 'Letters'|'Papers'})`; papers `.nb-paper` (expands `.paper-body`).
- Letter buttons named like `ㄱ 기역 g/k`; tapping fetches `/courses/ko-seoul/audio/<hash>.mp3`.
- Settings row `Readings under words: new words only|always|never` (ko only; button, click cycles).
- Top bar `[role=banner]`: "<place> · Day N, <part>" (ko: "<place> · <part>", no day and no rent row until the first paid scene, stall-shift). `setting-where` ("Seoul, 2000") is not shown on the quiet page.

## Visual novel (/)
- Only courses with `art/art.json` are offered (zh-china only); it probes ko/ja art.json and logs two 404 console errors per load. Expected noise, not a regression.
- Advance with button `Tap to continue`; top buttons `Sound`, `Notebook`, `What was said`, `Menu` (Menu opens Settings dialog).

## Gotchas
- Playwright MCP screenshots may only be written under the repo (`.playwright-mcp/...`); copy out and delete that dir after.
- Wrong replies loop: the NPC repeats slower; don't press the same wrong number in a loop.
- Playwright MCP `page.screenshot({path})` via browser_run_code_unsafe writes anywhere (e.g. scratchpad); only browser_take_screenshot is repo-bound.
- Clearing: after navigating from a game page, clear+reload once can leave `silver-tongue:settings` re-written with the old course (picker skipped). Clear+reload twice, then check for the picker.
- /ko/ (book course): no gloss rows; NPC line words are `ruby > button.w` + `rt` "reading · gloss" while onboarding (<10 words heard), reading only after. Only the latest NPC line has `button.q`. Later NPC lines in a scene have no `.who`.
- VN fresh underline (`.word.fresh`) exists only during the line's beat (box shows line, buttons `Say it again|Say it slowly`); once options appear the same line re-renders without `.fresh`. Check before tapping past.
- art.json 404s (ko-seoul, ja-japan) come from the VN page only; /ko/ and /quiet/ log none.
- ko desk automation: papers `idcard`, `newspaper`, `bill`. Loop: `.desk-card.next` click; reading screen `.big` = current syllable, type its single-syllable romanization into `.sum input` + Enter; `.next-btn` after each paper; then `.desk-knock button` ("open the door") starts room-wake directly (no menu). Papers/progress can't be pre-seeded: naming resets them.
- ko touch: new context `browser.newContext({viewport, hasTouch:true, isMobile:true})` makes `(pointer: coarse)` true (no numbers on onboarding replies, "Tap a word..." hint, no ↵ glyphs). Desktop context shows numbers, "Click a word...", `↵`.
- ko stage (book): the scene's first NPC line has `.hint` (look-up hint; gone after first word lookup or scene end, kept in `silver-tongue:lookup-hint:<course>`). Bold recognised words: `.w.sounded`. Footer: Status hidden until day 2; no `.keybar` on book courses (detect tiles by `.pieces .tiles`). First tiles show a one-time `.pieces .hint` (`silver-tongue:tiles-hint:<course>`).
- ko miss: one exchange stays on stage: `.said` = the wrong reply, `.their.reaction` = their reaction, `.tag` on the line, the clip replays slower; the tried slip gets `.tried` and goes last. A second miss replaces said/reaction and adds reading+meaning under the line. Nothing stacks; misses never enter history.
- ko anchor: no rent row until room-rent is done (scene flag `rent: true`), even when short.
- Cross-context screenshots: `page.screenshot({path})` via browser_run_code_unsafe; build chain after source edits: build-course (ui.ftl), quiet-web + vn-web build.mjs, site.ts; server on :4173 serves `site/` live.
- ko menus (book): one `.next-btn.only` (story scene here > bed at night > way to next scene > job); the rest in a quiet `.also` row, no numbers on touch; disabled items hidden. Ways read from `place-<id>-go` ("Go outside", "Go down the alley to the stall"); at bedtime the way reads "Go back to Min-jun's Room to sleep". Playing the chain = press `.next-btn.only` between scenes. NPCs read "The old man"/"The young woman" until their first scene ends.
- ko stage-1 chain and right replies (options shuffle; match with `rt` stripped and Hangul only):
  - room-wake: 네? / 아니요. / 민준 씨 방? / 저는 <name>입니다. / 안녕히 가세요.
  - street-hello: 안녕하세요. / 박 할아버지, 안녕하세요. / 저는 <name>입니다. / 감사합니다. / 아니요, 몰라요.
  - street-again: 네? / 다시 말해 주세요. / 천천히 말해 주세요. / 몰라요. (each repeat needs a new one; 네? again loops)
  - street-what: 한국어 책? / 책이에요. / 이거 뭐예요? / 신문이에요? / 저거는 가게, 이거는 책.  -> night, sleep
  - street-hungry: 네, 배고파요. / 아니요, 없어요. / 가게 어디예요? / 감사합니다, 할아버지. / 네. 안녕히 계세요.
  - shop-prices: 이거 주세요. / 우유도 주세요. / 네? 얼마예요? / 천천히 말해 주세요. / 네, 감사합니다. / 안녕히 계세요.
  - street-numbers: 몰라요. / 하나? / 하나, 둘, 셋. / 삼천 원? / 하나, 둘, 셋, 넷, 다섯! / then the next number (둘!..다섯!)
  - shop-count: 안녕하세요. / 천 원, 하나. 삼천 원이에요. / 하나, 둘, 셋. 삼천 원. / 괜찮아요. / 안녕히 계세요.  -> night, sleep
  - stall-intro (tiles): 안녕하세요 / 저는 <name>입니다. / 네, 배고파요. / 감사합니다 / 네, 맛있어요! / 네, 일해요! / 네 안녕히 계세요
  - stall-shift (repeatable): "<food> [n <counter>], 여기 있어요." matching the order
  - stall-family: 사진이에요? / 지금 없어요? / 감사합니다 (tiles)
  - room-rent: 안녕하세요 / 아니요 (tiles) / 오만 원이에요? / 네, 알아요. / 삼월까지? / 안녕히 가세요.
- browser_run_code_unsafe `filename` must be under the repo (`.playwright-mcp/`, delete after); no `require` inside. A reply map can live in `window.__M` (lost on reload). Templating JS with `String.replace` collapses `$$` to `$`.
- Site courses come from vn-web's dist: after a content/ui.ftl change run build-course, then vn-web build.mjs (copies courses), then site.ts; quiet build alone leaves `site/courses` stale.
