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
