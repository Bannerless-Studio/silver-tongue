# Terminal playtest loop (started 2026-09-27)

Scene-by-scene play of the terminal game with `npm run playtest` (tools/src/playtest.ts), judged for UX, narrative and audio, fixed, then the next scene. Rules applied: in-game text short; surprisal (expected state = whitespace); setting China 2004 (content/settings/china-city/README.md).

## Iteration 1 — intro, street-hello, street-hungry, street-numbers, noodle-intro, room-hello, warehouse-intro, warehouse-shift, delivery-intro

Shipped: reply glosses while a word is not yet known; first-time word line under NPC lines (curated short glosses in glosses-zh-short.ftl); gesture + meaning after two misses; focused scene screen; speech speed (default slow) honoured by the terminal player; surprisal pass (rank out of header, sound icon only when off, unpaid scenes end silently, notes deferred to explore, place text once, unavailable menu items dimmed); checker new-word bands (<30 met: 4, <60: 3, else 20%); compounds 那里/这里/哪里; scene rewrites (street-hello, street-hungry, noodle-intro interview); 2004 intro; narration trim (31 keys removed).

## Follow-ups

- Sleep before meeting the landlord: the key from room-hello should be what allows sleeping at home; first night sleeps rough anywhere (core rule + narration). In progress.
- Shift length/pay: warehouse-shift is 2 exchanges for ¥10; design says 3–5. Tune after a full bot playthrough measures days-to-gate.
- replyNeedsGloss drops a reply's gloss once every word is `known` (3 correct in a row, core KNOWN_STREAK). Accepted; revisit if testers miss glosses.
- Short-gloss warning: 呀 (stage 2+) has no curated gloss; add when stage 2 content starts.
- Phase 2 gate: no end-of-phase scene exists; the game just runs out of scenes. Needs a closing scene at the locked gate.
- Practice scenes (street-practice etc.) run a fixed script and repeat the same exchange (对不起→没关系 twice). Design wants repeatable practice drawn from the player's shaky words. Core feature gap; do after the HSK 1 pass.
- "Old Wang seems to have something to tell you." shows after every scene end once a note is pending. Verify it is one line per note, not per scene end.

## Review of iteration 1 (commit db5a61c) — remaining items

Fixed at once: noodle-intro count-alt1 "三个杯子！" was a correct answer offered as wrong (now 很好！).

- unlocked-many joins "scene · place" labels with " · " too; a cross-place batch is unreadable. Use ", " between scenes or put the place in brackets. (packages/tui/src/app.ts unlockedLabel)
- `log = []` on sceneStarted also runs when resuming mid-scene at startup and wipes the place description that session.
- Quitting mid-scene after a noteReady loses the one-time mentor hint; re-derive from core.state.notes.ready on startup.
- mpg123 ignores speed; hide the Speed row (or say "not with mpg123") when it is the player.
- menu.ts comment on sleep-away contradicts core; reconcile with the home-key rule.
- Content: hospital-checkup `sit` says 在医院里 while in the hospital (→ 请在这里坐十分钟); shop-intro 哪个苹果很好？ → 哪个苹果好？; street-hungry and noodle-intro share the identical like exchange.
- Untrack tsconfig.tsbuildinfo and ignore it.
- VN ignores MenuItem.disabled (no dimming); web-phase item.
- help.ts isPureAside is not depth-aware ("(a) b (c)"); no course gloss triggers it today.

## Iteration 2 — days 2–9 (room-rent, delivery-*, tea-*, taxi-*, class-*, stairs-*, shop-*, noodle-kitchen/lunch, hospital-checkup)

Reads well: room-rent, warehouse-shift, tea-intro, tea-weather, taxi-way, class-first, hospital-checkup, stairs-meet/family/pets, shop-intro (haggling), noodle-kitchen (runs out of cups → shop), class-read, tea-shift, shop-buy, taxi-luggage, delivery-station.

Fix:
- Parcel state said three times at pickup (narration + errand-started + errand-carrying) while the header shows "parcel". → keep narration + header only.
- "Old Wang seems to have something to tell you." after almost every scene (each scene readies a note), and at session start between the walk-home place descriptions. → once, when the first unread note appears.
- Rent: header shows "rent due" but nothing says what happened. Night of day 7 with ¥36 and day 8 with ¥48: silent. → one line on the night it goes late ("Rent is ¥50. Mr Li will wait.") and one when it is paid ("-¥50 (rent)" already exists).
- Dates: class-write writes 二零二六年, taxi-visitor 二零二五年; the setting is 2004. → 二零零四年 / 二零零三年.
- Wrong-sense glosses: 点 "point" (→ o'clock), 字 "letter" (→ character), 月 "moon" (→ month), 日 "sun" (→ day). Curated.
- tea-tv is a topic jumble (phone call, dog, movie, be quiet) → rewrite as one coherent evening in front of the TV.
- noodle-lunch: the cook asks the player how much the customer's dish costs (那个小姐想吃菜，多少钱？→ 她？十块钱。). → cook states the price, player relays it.
- Place descriptions replay on every new session while walking (once per session). Acceptable for real play; harness resumes make it look worse.

Stage gate: no gate place exists yet (spec: "a locked gate to the stage 2 district"). Build it with HSK 2: a police-station/gate scene about a month in (the passport excuse), which opens the stage-2 district.

## Handoff (session ended 2026-09-27, usage limit)

Committed and pushed: sleep-rough rule (72da923), playtest navigation flags (1deae65). Uncommitted in the working tree when the session stopped — two workers were mid-task:
- Review follow-ups + TUI fixes (packages/tui, view/help.ts, tui-node speed row for mpg123, hospital-checkup/shop-intro lines). At stop: checker failed on 下/里 coverage (hospital `sit` line changed) and 6 missing clips. Finish: restore 下 and 里 in ≥3 scenes each, run `npm run audio -- zh-china`, then all four gates.
- Content fixes (class-write/taxi-visitor years → 2004/2003, tea-tv rewrite, noodle-lunch price line). Clips not generated yet: same `npm run audio` run.
Then: rent-late line in the TUI (see Iteration 2), release 0.15.0 (CHANGELOG entry first), then HSK 2 with the stage gate scene.
Playtest with `npm run playtest -- --run <name> --seed 3 --play <scene>` and `--resume <name> --play/--sleep/--goto`.
