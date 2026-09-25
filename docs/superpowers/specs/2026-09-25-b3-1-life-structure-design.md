# B3, slice 1: life structure

2026-09-25 · status: design approved in conversation, written up for review

B3 is the full stage-1 content milestone. It is too big for one release, so it ships as three slices, each playable on a phone:

1. **Life structure** (this document, `silver-tongue@0.7.0`): a room and a landlord, sleeping only at home, an Old Wang numbers scene before the noodle shift, and narration for every action.
2. **Jobs and places:** dishwasher, delivery and porter; the fruit stall, supermarket, bus stop, warehouse and tea house; numbers 6–10; the landlord's rent talk. Batches of scenes per place.
3. **Coverage and economy:** fill the remaining HSK 1 word gaps (today 29 of 150 words appear in any scene, 6 in three or more), turn on `checks.coverage`, and tune pay, rent and pacing with the bots.

The main design is `2026-09-25-silver-tongue-design.md`; the first course scope is at the end of it. This document covers only slice 1.

## Goal

The player has a home. Days end in the room, the landlord is a person, and the noodle shop's counting is taught before it is needed. A wrong reply in any conversation says what was actually asked, in every scene, and the checker makes sure new scenes keep it that way.

Success:

- Sleeping away from the room is refused with a clear message; sleeping in it works as before.
- A new player meets the landlord, and counts 一 to 五 with Old Wang before the noodle shift is offered.
- Every action a scene uses has an `asked-<action>` line, and the build fails when one is missing.
- The bots still reach every scene with no dead ends and read every note, and they never send an input the core refuses.
- Existing saves still load. A save that has done `noodle-intro` but not the numbers scene sees the shift locked until it does.

Not in this slice: rent talk and paying rent in person (needs 五十, so slice 2), numbers 6–10, new jobs, economy changes, and any new mentor notes.

## 1. Room and sleeping

**World (`content/settings/china-city/world.json`)**

- New place `room`, linked both ways with `street`.
- New NPC `landlord` in `room`.
- New optional field `home: "room"`.
- `World` in `packages/core/src/types.ts` gains `home?: string`. The build passes `world.json` through whole, so nothing else in the build changes.

**Core (`packages/core/src/core.ts`)**

`sleep` gains one check, after the existing in-scene check:

```ts
case "sleep":
  if (state.run) return reject(ctx, "in-scene");
  if (course.world.home && state.place !== course.world.home) return reject(ctx, "not-home");
  ctx.ev.push(...endDay(course, state));
  return;
```

- `REJECT_REASONS` gains `"not-home"`. This is the only change to `Input` and `GameEvent`; it is additive, so the future 3D front end is not affected.
- A course without `home` behaves exactly as today.
- Travel stays free (no slot cost), so going home never costs a slot.
- There is no save-schema change. `SAVE_VERSION` stays 1, and `parseSave` still checks that `place` exists in the course.

**Front ends**

- `packages/tui/src/text.ts` builds its `reject-<reason>` keys from `REJECT_REASONS`, so `reject-not-home` becomes a required UI string automatically. Add it to `content/learner/en/ui.ftl`: "You want your own bed. Head home first."
- The Sleep item stays in the menu everywhere. Choosing it away from home shows the rejection message. The terminal and the web front end share `app.ts`, so neither needs its own change.

**Narration (`content/learner/en/narration-china-city.ftl`)**

- `place-room`, `place-room-desc`, `npc-landlord`.
- `place-street-desc` gets a mention of the way to the room.
- The intro gains the room: one edit to `intro-3` (exact wording in the plan) along the lines of "A room down the street is waiting for you. Rent is ¥50, due at the end of the week."

## 2. Landlord

One scene, `room-hello` ("Meet the landlord"), in the room with the landlord.

- `after: ["street-hello"]`, not repeatable, `trustGain: 1`, no pay.
- About five exchanges of the same kind as `noodle-intro`: greet, exchange names, say you live here, thank them, say goodbye.
- New words: 住 (w0027) and 这 (w0142), both HSK 1. They go in different exchanges, or together in one, since the limit is two new words per exchange. The checker enforces this and the reply-word limits, so the exact lines are settled in the plan.
- Actions reuse `greet`, `names` and `bye` from `noodle-intro`, plus new ones for what is new (for example `live`, `thanks`). Each new action gets an `asked-` line (section 4).
- Every line has its English in `content/learner/en/lines-zh/room-hello.ftl`, and wrong replies use only words already met.
- Rent stays automatic at the end of each week, exactly as in `life.ts`. The scene is about meeting the person, not paying.

## 3. Numbers: "Count with Old Wang"

One scene, `street-numbers`, on the street with Old Wang.

- `after: ["street-hungry"]`, not repeatable, no pay, `trustGain: 1`.
- Teaches 一 二 三 四 五, at most two new words per exchange, in this shape (five exchanges):
  - `one-two`: introduces 一 and 二.
  - `three-four`: introduces 三 and 四.
  - `five`: introduces 五.
  - `show-a` and `show-b`: both slotted, `slots: { count: "numbers_1_5" }`, with every number met. Old Wang holds up fingers and the player answers with the number. Two exchanges, so two different numbers usually come up.
- Actions: `numbers` for the three teaching exchanges, and `show` (with `count: "$count"`) for the slotted ones.

**Content plumbing**

- `groups.json`: a new group `numbers_1_5` (one to five), and `numbers` gains `one: 1` and `two: 2` (used for plural selection).
- `languages/zh/terms.ftl` and `learner/en/terms.ftl`: `-one` and `-two`, in the same shape as `-three`.
- The numbers 一 二 三 四 五 are the HSK 1 words w0001, w0019, w0003, w0060, w0020.
- Orders keep `numbers_3_5`. 二 as a counting word is fine here, but 两 (the form used before measure words) is HSK 2 and so not allowed at stage 1.

**Gating**

- `noodle-shift` becomes `after: ["noodle-intro", "street-numbers"]`. `noodle-intro` is unchanged.
- Once the player has counted, the shift's numbers 三–五 are already met. The shift's exchanges then introduce fewer new words than before, which the checker allows.
- Street menu size: with the two exits (noodle shop, room), four scenes (hello, hungry, practice, numbers) and the mentor item, the street reaches exactly 7 items. Slice 2 must not add street scenes without moving one.

## 4. Narration for every action

- `content/learner/en/narration-china-city.ftl` gets one `asked-<action>` line for each of the 18 conversational actions the pilot uses (`answer`, `ask`, `bye`, `farewell`, `friend`, `greet`, `hello`, `hungry`, `how`, `job`, `like`, `name`, `names`, `noodles`, `shop`, `there`, `wang`, `zhang`), plus one for each new action from sections 2 and 3. `fetch` and `serve` already have theirs.
- The lines say what was wanted, not what to type: "They wanted to know your name." Slotted actions take the action's parameters, for example `asked-show = Old Wang held up { $count } fingers.`
- An `asked-` line belongs to the action, not the scene, so every scene that uses the action shows the same line. A line may name an NPC only if one NPC uses that action. The landlord reuses `greet`, `names` and `bye`, so those lines must say "they", not "Old Wang" or "the cook".
- A written wrong reply already reaches this path: the core reports it as action `other`, not matched, so the TUI shows the `asked-` line of the expected action.
- The TUI already shows `asked-<action>` after a mix-up and falls back to the generic line when there is none. No TUI change.
- The build already checks that a narration line formats with its action's parameters.

## 5. Checker (`tools/src/check.ts`)

Three additions:

1. **Narration:** every distinct `expect.action` used by any scene must have an `asked-<action>` message in the learner text (`learnerIds`). Error: `narration: no "asked-<action>" line (used by <scene>)`. Always on, so slice 2 and 3 content cannot skip it.
2. **Home:** if `world.home` is set it must name an existing place. Error: `world: home "<id>" is not a place`.
3. **Menu size:** `MAX_PLACE_ITEMS` also counts the mentor's visit item at the mentor NPC's place. Without it the street could reach eight items, and `menu()` in the TUI would silently cut the last exits.

## 6. Bots (`tools/src/bots.ts`)

- When a bot would sleep (out of slots or goals), and the course has `home`, and the bot is not there, it walks toward home with `goTo` first, then sleeps. `stepToward` already exists.
- `BotReport` gains `rejected: number`, the count of inputs the core refused. The CI test requires 0, so a bot that keeps sending a refused input (such as sleep away from home) fails the test instead of spinning to the 100,000-step cap.
- The existing checks stay: no dead-end days, every note read, no bot broke without paid work.

## 7. Compatibility

- `Input` and `GameEvent`: unchanged. `RejectReason` gains `"not-home"`, `World` gains an optional `home`. Both are additive.
- Saves: no new fields. An old save whose player is anywhere loads; if it is away from the room, it walks home to sleep like anyone else.
- A save that has done `noodle-intro` but not the numbers scene sees the noodle shift locked until Old Wang's numbers scene is done. The `unlocked` event fires when it is done.
- The export line (`st1:`) and the saved-games codec are unchanged.

## 8. Testing and release

**Tests first (Vitest)**

- `packages/core/test/core.test.ts`: with `home` set, `sleep` away is refused with `not-home` and leaves the state untouched; at home it ends the day; without `home` it works anywhere (the fixture in `packages/core/src/testing/fixture.ts` gets a home variant).
- `packages/tui/test/app.test.ts`: with a fixture that has `home`, choosing Sleep away from home shows "You want your own bed. Head home first." and the day doesn't end. The existing "sleeping ends the day" test uses a fixture without `home` and stays as it is.
- `tools/test/check.test.ts`: each of the three new checker errors, and a passing case for each.
- `tools/test/bots.test.ts`: `rejected` is 0 for every bot. With `home` set, that also means every day ended in the room.
- Existing build and course tests keep passing with the new scenes.

**By hand**

- Play the real build: a python pty in the terminal, and Playwright with `google-chrome` in the browser (the harness scripts are in `/home/jamil/.claude/jobs/91570df1/tmp/pw/`). Walk from the start to the room, meet the landlord, try to sleep on the street, sleep at home, do the numbers scene, and start the noodle shift.
- The user play-tests on a phone after release and sends short feedback.

**Before release:** `npm run typecheck && npm run build:course && npx vitest run`, then an opus review of the change with Important findings fixed before the merge. Release means bumping `packages/tui-node/package.json` to 0.7.0, running `npm install --package-lock-only`, and merging to `main`.

## Open items for the plan

- Exact Chinese lines and English meanings for `room-hello` and `street-numbers`, settled with the checker's limits (two new words per exchange, reply of at most 7 words, NPC line of at most 9).
- The exact wording of the intro change and of the `asked-` lines.
- Whether `street-practice` should also cover counting later. Not in this slice.
