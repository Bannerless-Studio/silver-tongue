# B3 slice 2a: the warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Market Street with your room and a warehouse. Big Liu teaches 六 to 十 and gives you a paid furniture-carrying shift, and Mr Li tells you the rent in Chinese. Ships as `silver-tongue@0.8.0`.

**Architecture:** Content only: world JSON, scene skeletons, Fluent lines, groups, terms, notes. There is no core, TUI or tool code change. Each task's test is a content test in `tools/test/build-course.test.ts` plus the checker, which runs inside `npm run build:course` and inside that test file. Every line below was drafted in a scratch copy and passed the real checker and bots before this plan was written.

**Tech Stack:** TypeScript, Vitest, Fluent, JSON content.

**Spec:** `docs/superpowers/specs/2026-09-25-b3-2a-warehouse-design.md`

## Global Constraints

- No change to `packages/core`, `packages/tui*` or `tools/src`.
- Run `npm run build:course` after every content change. Never commit with checker errors.
- Never edit `content/languages/zh/words.json`, `content/learner/en/glosses-zh.ftl` or `dist/`.
- Bonus and name words go in `content/languages/zh/extra-words.json`, with glosses in `content/learner/en/glosses-zh-extra.ftl`.
- An `asked-` line names no NPC unless only one NPC uses that action.
- Slot names that have a `wrong-<slot>` reaction keep to one group. `count` is the noodle shop's, so the warehouse uses `amount`.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4
  ```
- Branch: `b3-2-jobs-places` (the spec is committed there).

## Review Focus

1. **A 0.7.0 save standing in the room.** It loads, and its only exit is Market Street. Sleep still works there, and every place still reaches home. Pinned in Task 1 (map test). The checker's reachability rule runs in every build.
2. **A wrong pick in the warehouse shift.** The player sees `asked-carry` or `asked-pick` with English names ("They wanted eight chairs."), not 几杯？ and not the generic line. The slot names are pinned in Task 3. Check the text by hand in Task 5.
3. **Main Street's menu at exactly 7.** Adding Market Street must not push it to 8. Pinned in Task 1.
4. **The rent talk before the first rent day.** It unlocks after one warehouse shift. The bots show it on day 4, rent is due on day 7, and Task 5 checks the bot output.
5. **English plurals.** "{amount} {item}s" is right only for amounts of 2 or more. The group starts at 三, pinned in Task 3.

---

### Task 1: Market Street

**Files:**
- Modify: `content/settings/china-city/world.json`
- Modify: `content/learner/en/narration-china-city.ftl`
- Test: `tools/test/build-course.test.ts`

**Interfaces:**
- Produces: places `market` and `warehouse`, NPC `foreman` (at `warehouse`), and `room` linked only to `market`.

- [ ] **Step 1: Write the failing test.** In `tools/test/build-course.test.ts`, inside `describe("build-course (real content)", …)`, add:

```ts
  it("puts your room and the warehouse on Market Street, and keeps Main Street's menu at 7", () => {
    const { places, npcs, mentor } = course!.world;
    expect([...places.market.links].sort()).toEqual(["room", "street", "warehouse"]);
    expect(places.room.links).toEqual(["market"]);
    expect(places.street.links).toContain("market");
    const mentorHere = mentor && npcs[mentor.npc].place === "street" ? 1 : 0;
    expect(places.street.links.length + course!.scenes.filter((s) => s.place === "street").length + mentorHere).toBe(7);
  });
```

- [ ] **Step 2: Run it.** `npx vitest run tools/test/build-course.test.ts`. Expected: FAIL, because `places.market` is undefined.

- [ ] **Step 3: Write the world.** Replace the `places` and `npcs` objects in `content/settings/china-city/world.json` (keep every other field as it is):

```json
  "places": {
    "street": { "links": ["noodle_shop", "market"] },
    "noodle_shop": { "links": ["street"] },
    "market": { "links": ["street", "room", "warehouse"] },
    "room": { "links": ["market"] },
    "warehouse": { "links": ["market"] }
  },
  "npcs": {
    "wang": { "place": "street" },
    "cook": { "place": "noodle_shop" },
    "landlord": { "place": "room" },
    "foreman": { "place": "warehouse" }
  },
```

In `content/learner/en/narration-china-city.ftl`, replace `place-street-desc` with:

```
place-street-desc = Bikes, steam and shouting. An old man sits on a bench by the road. Across it, a noodle shop glows, and past it the street opens onto a market.
```

After the `place-room-desc` line, add:

```
place-market = Market Street
place-market-desc = Stalls, scooters and a warehouse with its doors wide open. Your room is up the stairs above a shuttered shop.
place-warehouse = Warehouse
place-warehouse-desc = Stacks of tables and chairs, and a big man with a clipboard.
```

After `npc-landlord = Mr Li`, add `npc-foreman = Big Liu`.

- [ ] **Step 4: Run.** `npm run build:course && npx vitest run tools && npm run bots`. Expected: the build passes with 7 scenes, the tests pass, and every bot shows `rejected 0` and `dead-end days 0`.

- [ ] **Step 5: Commit.**

```bash
git add content/ tools/test/build-course.test.ts
git commit -m "content: Market Street; your room moves there, next to a warehouse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 2: Big Liu counts you to ten

**Files:**
- Create: `content/settings/china-city/scenes/warehouse-intro.json`
- Create: `content/languages/zh/lines/warehouse-intro.ftl`
- Create: `content/learner/en/lines-zh/warehouse-intro.ftl`
- Modify: `content/languages/zh/extra-words.json`, `content/learner/en/glosses-zh-extra.ftl`, `content/learner/en/narration-china-city.ftl`
- Test: `tools/test/build-course.test.ts`

**Interfaces:**
- Consumes: `warehouse` and `foreman` (Task 1).
- Produces: scene `warehouse-intro`, action `foreman`, word `x0006` (大刘).

- [ ] **Step 1: Write the failing test.** Change the pinned scene list in `builds zh-china-en with no errors` to:

```ts
    expect(course!.scenes.map((s) => s.id)).toEqual(["noodle-intro", "noodle-shift", "room-hello", "street-hello", "street-hungry", "street-numbers", "street-practice", "warehouse-intro"]);
```

and add:

```ts
  it("Big Liu counts you from six to ten, after you can count to five", () => {
    const intro = course!.scenes.find((s) => s.id === "warehouse-intro")!;
    expect(intro.after).toEqual(["street-numbers"]);
    const heard = intro.exchanges.flatMap((ex) => ex.variants[""].npc.tokens.map((t) => course!.words[t.word].w));
    for (const n of ["六", "七", "八", "九", "十"]) expect(heard).toContain(n);
  });
```

- [ ] **Step 2: Run it.** `npx vitest run tools/test/build-course.test.ts`. Expected: FAIL, because there is no `warehouse-intro`.

- [ ] **Step 3: Add the name word.** Append to the array in `content/languages/zh/extra-words.json`:

```json
  { "id": "x0006", "w": "大刘", "lv": "1", "pron": "Dà Liú" }
```

(Add a comma after the `x0005` entry.) Append to `content/learner/en/glosses-zh-extra.ftl`:

```
x0006 = Big Liu, the warehouse foreman (大 "big" + the surname Liu)
```

- [ ] **Step 4: The scene.** Create `content/settings/china-city/scenes/warehouse-intro.json`:

```json
{
  "id": "warehouse-intro",
  "place": "warehouse",
  "npc": "foreman",
  "stage": 1,
  "after": ["street-numbers"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "greet", "slots": {}, "expect": { "action": "greet" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "names", "slots": {}, "expect": { "action": "foreman" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "six-seven", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "eight-nine", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "ten", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "job", "slots": {}, "expect": { "action": "job" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

Create `content/languages/zh/lines/warehouse-intro.ftl`:

```
# The foreman counts you up to ten, then offers work. Wrong replies use only words met by then.

greet = 你好！你叫什么名字？
greet-reply = 我叫{ $player }。
greet-alt1 = 我饿了。
greet-alt2 = 再见！

names = 我叫大刘。
names-reply = 你好，大刘！
names-alt1 = 我叫老王。
names-alt2 = 我喜欢面条。

six-seven = 一，二，三，四，五，六，七。
six-seven-reply = 六，七。
six-seven-alt1 = 一，二。
six-seven-alt2 = 很好！

eight-nine = 六，七，八，九。
eight-nine-reply = 八，九。
eight-nine-alt1 = 六，七。
eight-nine-alt2 = 再见！

ten = 八，九，十！
ten-reply = 十！
ten-alt1 = 五！
ten-alt2 = 我饿了。

job = 很好！你会工作吗？
job-reply = 会！
job-alt1 = 我叫{ $player }。
job-alt2 = 我喜欢面条。

bye = 好！再见，{ $player }！
bye-reply = 谢谢！再见，大刘！
bye-alt1 = 你好，大刘！
bye-alt2 = 十！
```

Create `content/learner/en/lines-zh/warehouse-intro.ftl`:

```
greet = Hello! What's your name?
greet-reply = My name is { $player }.
greet-alt1 = I'm hungry.
greet-alt2 = Goodbye!

names = I'm Big Liu.
names-reply = Hello, Big Liu!
names-alt1 = My name is Old Wang.
names-alt2 = I like noodles.

six-seven = One, two, three, four, five, six, seven.
six-seven-reply = Six, seven.
six-seven-alt1 = One, two.
six-seven-alt2 = Very well!

eight-nine = Six, seven, eight, nine.
eight-nine-reply = Eight, nine.
eight-nine-alt1 = Six, seven.
eight-nine-alt2 = Goodbye!

ten = Eight, nine, ten!
ten-reply = Ten!
ten-alt1 = Five!
ten-alt2 = I'm hungry.

job = Very good! Can you work?
job-reply = I can!
job-alt1 = My name is { $player }.
job-alt2 = I like noodles.

bye = Good! Goodbye, { $player }!
bye-reply = Thank you! Goodbye, Big Liu!
bye-alt1 = Hello, Big Liu!
bye-alt2 = Ten!
```

- [ ] **Step 5: Narration.** In `content/learner/en/narration-china-city.ftl`, after the `scene-room-hello-end` line, add:

```

scene-warehouse-intro = Ask about work
scene-warehouse-intro-start = The big man with the clipboard looks up. He holds up five fingers, then all ten, and raises an eyebrow: can you count that far?
scene-warehouse-intro-end = Big Liu writes something on his clipboard, possibly your name. There's work here whenever you want it.
```

In the conversations block, after `asked-next`, add:

```
asked-foreman = They were telling you their name.
```

- [ ] **Step 6: Run.** `npm run build:course && npx vitest run tools && npm run bots`. Expected: the build passes with 8 scenes, the tests pass, and the bots show `rejected 0`, `dead-end days 0` and `warehouse-intro:2`.

- [ ] **Step 7: Commit.**

```bash
git add content/ tools/test/build-course.test.ts
git commit -m "content: Big Liu at the warehouse counts you to ten and offers work

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 3: Carry furniture

**Files:**
- Create: `content/settings/china-city/scenes/warehouse-shift.json`
- Create: `content/languages/zh/lines/warehouse-shift.ftl`
- Create: `content/learner/en/lines-zh/warehouse-shift.ftl`
- Modify: `content/settings/china-city/groups.json`, `content/languages/zh/terms.ftl`, `content/learner/en/terms.ftl`, `content/learner/en/narration-china-city.ftl`
- Test: `tools/test/build-course.test.ts`

**Interfaces:**
- Consumes: `warehouse-intro` and trust with `foreman` (Task 2).
- Produces: scene `warehouse-shift`; groups `numbers_3_10`, `furniture`, `sizes`; concepts `six`–`ten`, `table`, `chair`, `big`, `small`; actions `carry`, `pick`.

- [ ] **Step 1: Write the failing test.** Add `"warehouse-shift"` to the end of the pinned scene list, and add:

```ts
  it("the warehouse shift counts from three to ten, in its own slot", () => {
    const shift = course!.scenes.find((s) => s.id === "warehouse-shift")!;
    const carry = shift.exchanges.find((ex) => ex.id === "carry")!;
    // Not `count`: that slot's reaction is the noodle shop's 几杯？
    expect(carry.slots).toEqual({ amount: "numbers_3_10", item: "furniture" });
    // English says "{amount} {item}s", so no amount may be one or two.
    expect(course!.groups.numbers_3_10[0]).toBe("three");
    expect(shift.exchanges.every((ex) => ex.pay > 0)).toBe(true);
  });
```

- [ ] **Step 2: Run it.** `npx vitest run tools/test/build-course.test.ts`. Expected: FAIL, because there is no `warehouse-shift`.

- [ ] **Step 3: Groups and terms.** In `content/settings/china-city/groups.json`, add these groups:

```json
    "numbers_3_10": ["three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    "furniture": ["table", "chair"],
    "sizes": ["big", "small"]
```

and add to `numbers`: `"six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10`.

Append to `content/languages/zh/terms.ftl`:

```
-six = 六
-seven = 七
-eight = 八
-nine = 九
-ten = 十
-table = 桌子
-chair = 椅子
-big = 大
-small = 小
```

Append to `content/learner/en/terms.ftl`:

```
-six = { $form ->
    [cap] Six
   *[base] six
}
-seven = { $form ->
    [cap] Seven
   *[base] seven
}
-eight = { $form ->
    [cap] Eight
   *[base] eight
}
-nine = { $form ->
    [cap] Nine
   *[base] nine
}
-ten = { $form ->
    [cap] Ten
   *[base] ten
}
-table = { $form ->
    [cap] Table
   *[base] table
}
-chair = { $form ->
    [cap] Chair
   *[base] chair
}
-big = { $form ->
    [cap] Big
   *[base] big
}
-small = { $form ->
    [cap] Small
   *[base] small
}
```

- [ ] **Step 4: The scene.** Create `content/settings/china-city/scenes/warehouse-shift.json`:

```json
{
  "id": "warehouse-shift",
  "place": "warehouse",
  "npc": "foreman",
  "stage": 1,
  "after": ["warehouse-intro"],
  "requires": { "trust": { "foreman": 1 } },
  "repeatable": true,
  "trustGain": 1,
  "exchanges": [
    {
      "id": "carry",
      "slots": { "amount": "numbers_3_10", "item": "furniture" },
      "expect": { "action": "carry", "amount": "$amount", "item": "$item" },
      "hinges": ["$amount", "$item"],
      "pay": 3,
      "missCost": 1
    },
    {
      "id": "pick",
      "slots": { "size": "sizes", "item": "furniture" },
      "expect": { "action": "pick", "size": "$size", "item": "$item" },
      "hinges": ["$size", "$item"],
      "pay": 2,
      "missCost": 1
    }
  ]
}
```

Create `content/languages/zh/lines/warehouse-shift.ftl`:

```
carry = { -amount }个{ -item }。
carry-reply = 好，{ -amount }个{ -item }。
carry-rephrase = { -item }。{ -amount }个。

pick = 那个{ -size }{ -item }。
pick-reply = 好，那个{ -size }{ -item }。
pick-rephrase = { -size }{ -item }。那个！
```

Create `content/learner/en/lines-zh/warehouse-shift.ftl`:

```
carry = { -amount(form: "cap") } { -item }s.
carry-reply = OK, { -amount } { -item }s.
carry-rephrase = { -item(form: "cap") }s. { -amount(form: "cap") } of them.

pick = That { -size } { -item }.
pick-reply = OK, that { -size } { -item }.
pick-rephrase = The { -size } { -item }. That one!
```

- [ ] **Step 5: Narration.** After the `scene-warehouse-intro-end` line, add:

```

scene-warehouse-shift = Carry furniture
scene-warehouse-shift-start = A truck backs up to the doors. Big Liu reads from his clipboard; you do the lifting.
scene-warehouse-shift-end = The truck pulls away. Big Liu counts out your pay, twice.
```

After the noodle shop's `asked-serve` line (the action block at the end of the scenes section), add:

```
action-carry = You carry { $amount } { $item }s.
asked-carry = They wanted { $amount } { $item }s.
action-pick = You pick up the { $size } { $item }.
asked-pick = They wanted the { $size } { $item }.
```

- [ ] **Step 6: Run.** `npm run build:course && npx vitest run tools && npm run bots`. Expected: the build passes with 9 scenes, the tests pass, and the bots show `rejected 0`, `dead-end days 0` and `broke without work 0`.

- [ ] **Step 7: Commit.**

```bash
git add content/ tools/test/build-course.test.ts
git commit -m "content: carry furniture at the warehouse (个, 桌子, 椅子, 大, 小, three to ten)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 4: Mr Li and the rent, and two notes

**Files:**
- Create: `content/settings/china-city/scenes/room-rent.json`
- Create: `content/languages/zh/lines/room-rent.ftl`
- Create: `content/learner/en/lines-zh/room-rent.ftl`
- Modify: `content/languages/zh/notes.json`, `content/learner/en/mentor-zh.ftl`, `content/learner/en/narration-china-city.ftl`
- Test: `tools/test/build-course.test.ts`

**Interfaces:**
- Consumes: `room-hello` (slice 1) and `warehouse-shift` (Task 3); 个 is first met in the shift.
- Produces: scene `room-rent`; actions `money`, `rent`, `price`; notes `ge`, `kuai`.

- [ ] **Step 1: Write the failing test.** Add `"room-rent"` to the pinned scene list in its sorted place (after `"room-hello"`), and add:

```ts
  it("Mr Li talks about rent after your first warehouse shift, and Old Wang explains 个 and 块", () => {
    expect(course!.scenes.find((s) => s.id === "room-rent")!.after).toEqual(["room-hello", "warehouse-shift"]);
    expect(course!.notes.map((n) => n.id)).toEqual(expect.arrayContaining(["ge", "kuai"]));
  });
```

- [ ] **Step 2: Run it.** `npx vitest run tools/test/build-course.test.ts`. Expected: FAIL, because there is no `room-rent`.

- [ ] **Step 3: The scene.** Create `content/settings/china-city/scenes/room-rent.json`:

```json
{
  "id": "room-rent",
  "place": "room",
  "npc": "landlord",
  "stage": 1,
  "after": ["room-hello", "warehouse-shift"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "greet", "slots": {}, "expect": { "action": "greet" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "money", "slots": {}, "expect": { "action": "money" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "week", "slots": {}, "expect": { "action": "rent" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "price", "slots": {}, "expect": { "action": "price" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

Create `content/languages/zh/lines/room-rent.ftl`:

```
# Mr Li and the rent. Wrong replies use only words met by then.

greet = 你好，{ $player }！
greet-reply = 你好，李先生！
greet-alt1 = 我饿了。
greet-alt2 = 再见！

money = 你有钱吗？
money-reply = 有。我工作。
money-alt1 = 我喜欢面条。
money-alt2 = 我叫{ $player }。

week = 一个星期……
week-reply = 多少钱？
week-alt1 = 十个椅子。
week-alt2 = 你好吗？

price = 五十块。
price-reply = 好，五十块。
price-alt1 = 五个桌子。
price-alt2 = 谢谢！再见！

bye = 谢谢！再见！
bye-reply = 再见，李先生！
bye-alt1 = 你好，李先生！
bye-alt2 = 我饿了。
```

Create `content/learner/en/lines-zh/room-rent.ftl`:

```
greet = Hello, { $player }!
greet-reply = Hello, Mr Li!
greet-alt1 = I'm hungry.
greet-alt2 = Goodbye!

money = Do you have money?
money-reply = Yes. I work.
money-alt1 = I like noodles.
money-alt2 = My name is { $player }.

week = One week…
week-reply = How much?
week-alt1 = Ten chairs.
week-alt2 = How are you?

price = Fifty kuai.
price-reply = OK, fifty kuai.
price-alt1 = Five tables.
price-alt2 = Thank you! Goodbye!

bye = Thank you! Goodbye!
bye-reply = Goodbye, Mr Li!
bye-alt1 = Hello, Mr Li!
bye-alt2 = I'm hungry.
```

- [ ] **Step 4: Narration.** After the `scene-room-hello-end` line, add:

```
scene-room-rent = Talk about rent
scene-room-rent-start = Mr Li is waiting at the top of the stairs. He rubs his thumb and fingers together, politely.
scene-room-rent-end = Mr Li nods and writes it on the back of his hand: fifty, every week. It'll come out of your pocket at the end of the week either way.
```

In the conversations block, after `asked-foreman`, add:

```
asked-money = They wanted to know if you have money.
asked-rent = They were talking about the week's rent.
asked-price = They told you the price.
```

- [ ] **Step 5: Notes.** Append to the array in `content/languages/zh/notes.json`:

```json
  { "id": "ge", "trigger": { "word": "w0012" } },
  { "id": "kuai", "trigger": { "scene": "room-rent" } }
```

Append to `content/learner/en/mentor-zh.ftl`:

```

note-ge-title = 个, the everyday measure word
note-ge = 个 (gè) is the measure word you can use for almost anything: 八个椅子, "eight chairs". For two of something, say 两 (liǎng), not 二: 两个桌子. 二 is for counting and for numbers like 十二.

note-kuai-title = 块, money
note-kuai = Prices on a sign say 元 (yuán), but people say 块 (kuài): 五十块 is fifty yuan. 多少钱？ is "how much?", literally "how much money?"
```

- [ ] **Step 6: Run.** `npm run build:course && npx vitest run && npm run typecheck && npm run bots`. Expected:
  - the build passes with 10 scenes, and all tests and the typecheck pass;
  - the bots show `rejected 0`, `dead-end days 0`, `broke without work 0` and `notes 7/7`;
  - `room-rent` is first done by day 4, before the first rent on day 7.

- [ ] **Step 7: Commit.**

```bash
git add content/ tools/test/build-course.test.ts
git commit -m "content: Mr Li talks about rent (多少钱, 五十块); notes on 个 and 块

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 5: Play it, review it, release 0.8.0

**Files:**
- Modify: `packages/tui-node/package.json` (`version`), `package-lock.json`
- Modify: the `silver-tongue-status` memory

- [ ] **Step 1: Full verification.** `npm run typecheck && npm run build:course && npx vitest run && npm run build:web`. Expected: all pass.

- [ ] **Step 2: Play through the app.** Write a temporary script `tools/src/zz-play.ts` that drives `startApp` with `FakeTerminal` on the built course, as in slice 1, and delete it afterwards. Play this path:
  1. Old Wang's scenes, then the noodle shop.
  2. Market Street, then the warehouse, then Big Liu counts to ten.
  3. A shift, picking one wrong `carry` answer on purpose: see "They wanted … chairs/tables." and not 几杯？.
  4. Home through Market Street: Mr Li's rent talk, then sleep.
  5. On the next day, the mentor item offers the 个 note.

  Then run the real CLI in a python pty: go to Market Street, then the room, and sleep.

- [ ] **Step 3: Browser.** At phone width (`W=390 H=760`, no touch), use `smoke.mjs` in `/home/jamil/.claude/jobs/91570df1/tmp/pw/` to reach Market Street, and screenshot the menu. Expected: no page errors.

- [ ] **Step 4: Review.** Send an opus review agent the whole branch diff, the spec, and this Review Focus. Fix every Important finding test-first.

- [ ] **Step 5: Release.** Set `packages/tui-node/package.json` to `"version": "0.8.0"`, run `npm install --package-lock-only`, commit `release: 0.8.0`, then:

```bash
git checkout main
git merge --no-ff b3-2-jobs-places -m "Merge branch 'b3-2-jobs-places': the warehouse, counting to ten, the rent talk (0.8.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
git push origin main
```

Watch `ci`, `publish` and `pages` with `gh run watch <id> --exit-status`.

- [ ] **Step 6: Record it.** In the memory, record 0.8.0 as slice 2a and 2b (delivery and its places) as next. Tell the user what's new in a few lines.
