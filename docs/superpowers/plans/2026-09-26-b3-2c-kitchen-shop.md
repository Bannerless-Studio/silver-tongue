# B3 slice 2c: the kitchen and the shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `silver-tongue@0.10.0`: a repeatable dishwashing shift at the noodle shop, and a corner shop where a price you agree to comes out of your wallet.

**Architecture:**
- **Skeleton and build:** an exchange may name a `cost`, either a number or `"$slot"` resolved through `groups.json`'s `numbers`. The build resolves it per variant into `Variant.cost`.
- **Core:** it spends `variant.cost` on a right reply, with wallet reason `"shopping"`. A scene is offered only while the wallet covers the most it could cost.
- **"New:" lines:** because affordability can close and reopen a scene, a repeatable scene that was already played is never announced as new. This generalises 2b's pickup rule.
- **Content:** the kitchen scene, the shop's two scenes, and two mentor notes.

**Tech Stack:** TypeScript, Vitest, Fluent content, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-26-b3-2bc-deliveries-kitchen-shop-design.md` (Part 2 and §9).

## Global Constraints

- `Input`, `GameEvent`, `RejectReason` and `WalletReason` only ever grow. `"shopping"` is appended to `WALLET_REASONS`.
- Core stays free of I/O. Every UI string is in `UI_KEYS`. The `reason-<r>` keys come from `WALLET_REASONS` automatically.
- Run `npm run build:course` after content changes, and never ship checker errors.
- Never edit `words.json`, `pack.json` (except `stages`), `glosses-zh.ftl` or `dist/`.
- **Checker limits:**
  - ≤ 2 new words per exchange, replies ≤ 7 tiles, NPC lines ≤ 9 words;
  - ≤ 7 menu items per place;
  - wrong replies use only met words;
  - every action has `asked-<action>`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4
  ```
- **Release:** bump `packages/tui-node` to `0.10.0`, run `npm install --package-lock-only`, merge `--no-ff` to `main` and push. Then update the progress artifact https://claude.ai/artifact/MXUS9cc9XHZaMDCi2S13Ws.
- **Spec ruling:** the spec's name `wallet-shopping` means the existing pattern's key `reason-shopping`.

## Review Focus

1. **Not enough money:** a player with less money than a shop scene could cost doesn't see it on the menu. Once they earn enough it reappears, without a repeated "New:" line after the first time. Pinned by Task 1's tests "isn't offered…" and "…not announced again".
2. **Wrong answer in the shop:** a wrong reply (pick, tiles or a written alternative) buys nothing and costs nothing. Only the right reply spends. Pinned by Task 1's test "a wrong reply buys nothing".
3. **Near rent day:** buying never drops the wallet below zero, and the bots never shop into missing rent. Pinned by Task 1's affordability test and Task 2's bot rule.
4. **Old saves:** a 0.9.0 save, or a save mid-scene, loads unchanged; nothing in the save format changes. Pinned by the existing save tests, which must stay green.
5. **Market Street at the limit:** it has exactly 7 items (5 exits + 2 Miss Gao scenes) and still reads at phone width (46 columns). Pinned by Task 3's map test and Task 4's play-through.

---

### Task 1: Prices in core

**Files:**
- Modify: `packages/core/src/types.ts` (`Exchange.cost`, `Variant.cost`, `WALLET_REASONS`)
- Modify: `packages/core/src/life.ts` (`sceneCost`, `isAvailable`)
- Modify: `packages/core/src/dialogue.ts` (`resolve`)
- Modify: `packages/core/src/core.ts` (the unlock rule)
- Modify: `packages/core/src/index.ts` (export `sceneCost`, if `life` isn't re-exported wholesale)
- Test: `packages/core/test/core.test.ts`

**Interfaces:**
- **Produces:**
  - `Exchange.cost?: number | string` (skeleton; the core ignores it);
  - `Variant.cost?: number` (resolved; the core spends it);
  - `sceneCost(scene: Scene): number`, the sum over exchanges of the highest `variant.cost`;
  - `"shopping"` in `WALLET_REASONS`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/core.test.ts`:

```ts
describe("prices", () => {
  /** The fixture with the intro's greeting costing 3. */
  const priced = () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].cost = 3;
    return c;
  };
  const at = (c: ReturnType<typeof fixtureCourse>, patch: Partial<ReturnType<typeof newGame>> = {}) =>
    createCore(c, { ...newGame(c), place: "noodle_shop", ...patch }, { now: () => T0, rng: mulberry32(1) });

  it("a right reply pays the price, as shopping", () => {
    const core = at(priced());
    core.send({ type: "startScene", scene: "intro" });
    const ev = core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
    expect(find(ev, "walletChanged")).toEqual({ type: "walletChanged", wallet: 17, delta: -3, reason: "shopping" });
  });

  it("a wrong reply buys nothing", () => {
    const core = at(priced());
    core.send({ type: "startScene", scene: "intro" });
    const wrong = core.state.run!.options.findIndex((k) => k !== comboKey(core.state.run!.combo));
    const ev = core.send({ type: "reply", choice: wrong });
    expect(ev.filter((e) => e.type === "walletChanged" && e.reason === "shopping")).toEqual([]);
    expect(core.state.wallet).toBe(20);
  });

  it("sums a scene's highest price per exchange", () => {
    const c = priced();
    const menu = c.scenes[0].exchanges[1];
    menu.variants[comboKey({ item: "tea" })].cost = 2;
    menu.variants[comboKey({ item: "water" })].cost = 4;
    expect(sceneCost(c.scenes[0])).toBe(7);
    expect(sceneCost(c.scenes[1])).toBe(0);
  });

  it("isn't offered when the wallet can't cover the most it could cost", () => {
    const c = priced();
    expect(availableSceneIds(c, { ...newGame(c), wallet: 2 })).not.toContain("intro");
    expect(availableSceneIds(c, { ...newGame(c), wallet: 3 })).toContain("intro");
    expect(at(c, { wallet: 2 }).send({ type: "startScene", scene: "intro" })).toEqual([{ type: "inputRejected", reason: "locked" }]);
  });

  it("a repeatable scene played before is not announced again when it reopens", () => {
    const c = fixtureCourse();
    // The shift costs more than the wallet holds; a paid odd job makes it affordable again.
    for (const v of Object.values(c.scenes[1].exchanges[0].variants)) v.cost = 21;
    c.scenes.push({ ...structuredClone(c.scenes[0]), id: "odd", repeatable: true, exchanges: [{ ...structuredClone(c.scenes[0].exchanges[0]), pay: 5 }] });
    const core = at(c, { scenesDone: { intro: 1, shift: 1 }, trust: { cook: 2 }, wallet: 20 });
    expect(availableSceneIds(c, core.state)).not.toContain("shift");
    core.send({ type: "startScene", scene: "odd" });
    const ev: GameEvent[] = [];
    while (core.state.run) ev.push(...core.send({ type: "reply", choice: core.state.run.options.indexOf(comboKey(core.state.run.combo)) }));
    expect(availableSceneIds(c, core.state)).toContain("shift");
    expect(ev.filter((e) => e.type === "unlocked")).toEqual([]);
  });
});
```

Add `sceneCost` to the `../src/life` import, which already brings in `availableSceneIds`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run packages/core`
Expected: FAIL, because `sceneCost` doesn't exist yet. The other tests pass.

- [ ] **Step 3: Types**

In `packages/core/src/types.ts`:
- `Variant` gains
  ```ts
  /** what a right reply spends (resolved from the exchange's cost for this slot combination) */
  cost?: number;
  ```
- `Exchange` gains, after `missCost`,
  ```ts
  /** what a right reply spends: a number, or "$slot" whose value is a number concept. The build resolves it into each variant's cost. */
  cost?: number | string;
  ```
- `WALLET_REASONS` becomes `["wages", "mixup", "food", "rent", "shopping"] as const`.

- [ ] **Step 4: Affordability**

In `packages/core/src/life.ts`, add `Scene` to the type import if it is missing, and add:

```ts
/** The most a scene could cost: each exchange's dearest variant, added up. */
export function sceneCost(scene: Scene): number {
  return scene.exchanges.reduce((sum, ex) => sum + Math.max(0, ...Object.values(ex.variants).map((v) => v.cost ?? 0)), 0);
}
```

In `isAvailable`, before the trust check:

```ts
  // Nothing is bought on credit: a scene is offered only while the wallet covers the most it could cost.
  if (sceneCost(scene) > state.wallet) return false;
```

Re-export `sceneCost` from `packages/core/src/index.ts`, following however `availableSceneIds` is exported there.

- [ ] **Step 5: Spend on a right reply**

In `packages/core/src/dialogue.ts` `resolve`, in the `matched` branch, right after `run.earned += ex.pay;`:

```ts
    const cost = reply === undefined ? 0 : (ex.variants[comboKey(run.combo)].cost ?? 0);
    if (cost > 0) ctx.ev.push(...changeWallet(ctx.state, -cost, "shopping"));
```

(`reply` is already in scope in that branch as the right variant's reply. The guard only keeps the line self-explanatory; simplify it to `ex.variants[comboKey(run.combo)].cost ?? 0` if you prefer.)

- [ ] **Step 6: The unlock rule**

In `packages/core/src/core.ts`, replace the `again` line from 2b with:

```ts
        // A repeatable scene already played can close and reopen (a parcel in hand, a price out of reach); it was news only the first time.
        const again = !!scene?.repeatable && (ctx.state.scenesDone[id] ?? 0) > 0;
```

and delete the now-duplicate comment line about the pickup reopening.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run && npm run typecheck`
Expected: PASS. The errand test "announces the pickup once…" still passes under the general rule.

- [ ] **Step 8: Commit**

```bash
git add packages/core
git commit -m "core: prices — a right reply spends its variant's cost (shopping), a scene needs a wallet that covers it, and a reopened repeatable scene isn't news"
```

---

### Task 2: Build, checker, screen and bots

**Files:**
- Modify: `tools/src/build-course.ts` (resolve `cost`)
- Modify: `tools/src/check.ts` (`cost` must be a count)
- Modify: `tools/src/bots.ts` (shop only above a week's rent)
- Modify: `content/learner/en/ui.ftl` (`reason-shopping`)
- Test: `tools/test/build-course.test.ts`, `tools/test/check.test.ts`, `tools/test/bots.test.ts`, `packages/tui/test/app.test.ts`

**Interfaces:**
- Consumes: `Exchange.cost`, `Variant.cost`, `sceneCost` and `"shopping"` from Task 1.

- [ ] **Step 1: Write the failing tests**

`tools/test/build-course.test.ts`, in "build-course (broken content)":

```ts
  it("reports a cost that isn't a number or a slot of numbers", () => {
    const bad = buildChanged((d) => {
      const f = join(d, "settings/china-city/scenes/warehouse-shift.json");
      const sk = JSON.parse(readFileSync(f, "utf8"));
      sk.exchanges[0].cost = "$item";
      sk.exchanges[1].cost = "$nope";
      writeFileSync(f, JSON.stringify(sk));
    });
    expect(bad.errors).toContain('warehouse-shift/carry: cost "$item" must be a number or a slot whose values are all numbers');
    expect(bad.errors).toContain('warehouse-shift/pick: cost "$nope" must be a number or a slot whose values are all numbers');
  });

  it("resolves a slot's cost into each variant", () => {
    const ok = buildChanged((d) => {
      const f = join(d, "settings/china-city/scenes/warehouse-shift.json");
      const sk = JSON.parse(readFileSync(f, "utf8"));
      sk.exchanges[0].cost = "$amount";
      sk.exchanges[1].cost = 2;
      writeFileSync(f, JSON.stringify(sk));
    });
    const shift = ok.course!.scenes.find((s) => s.id === "warehouse-shift")!;
    expect(shift.exchanges[0].variants["amount=seven|item=chair"].cost).toBe(7);
    expect(shift.exchanges[1].variants["item=chair|size=big"].cost).toBe(2);
  });
```

`tools/test/check.test.ts`, in `describe("checkCourse")`:

```ts
  it("needs a whole-number cost", () => {
    const c = fixtureCourse();
    c.scenes[0].exchanges[0].variants[""].cost = -1;
    expect(checkCourse(input({ course: c }))).toContain("intro/greet: cost must be a whole number of 0 or more");
  });
```

`tools/test/bots.test.ts`, add a describe block:

```ts
describe("course bots (a world with a shop)", () => {
  it("shop only when a week's rent is left over, and never go broke doing it", () => {
    const c = fixtureCourse();
    for (const v of Object.values(c.scenes[1].exchanges[0].variants)) v.cost = 1; // the shift now also buys something
    c.world.rentPerWeek = 1000; // nobody ever has a week's rent spare
    const r = runBot(c, BOTS.right, { days: 3, seed: 1 });
    expect(r.rejected).toBe(0);
    expect(r.minWallet).toBeGreaterThan(0);
  });
});
```

This test uses the shift as a stand-in shop. Under the rule in Step 3, a costing scene counts as paid work only if the wallet stays above rent, so the bot keeps its money here.

`packages/tui/test/app.test.ts`, in `describe("tui app")`:

```ts
  it("shows money spent in a shop as shopping", () => {
    const { core, term } = setup(
      (s) => { s.place = "noodle_shop"; },
      (c) => { c.scenes[0].exchanges[0].variants[""].cost = 2; },
    );
    term.press("1"); // Say hello
    term.press(rightKey(core));
    expect(term.screen().join("\n")).toContain("-¥2 (shopping)");
  });
```

Before relying on `press("1")`, check that "Say hello" is item 1 in this fixture's noodle-shop menu. If it isn't, use a `pressItem` helper like 2b's.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tools packages/tui`
Expected: the new tests FAIL. There are no build errors or variant costs yet, no checker rule, and no `reason-shopping` string, which the TUI text check will report as missing. The bot test may already pass; if so, record in the ledger that it pins the rule rather than drives it.

- [ ] **Step 3: Implement**

`tools/src/build-course.ts`, in the combo loop, after `variants[comboKey(combo)] = variant;`:

```ts
          if (typeof ex.cost === "number") variant.cost = ex.cost;
          else if (typeof ex.cost === "string") {
            const concept = combo[ex.cost.slice(1)];
            if (ex.cost.startsWith("$") && concept in numbers) variant.cost = numbers[concept];
          }
```

and before the combo loop, after the unknown-groups check:

```ts
      if (typeof ex.cost === "string") {
        const group = ex.cost.startsWith("$") ? ex.slots[ex.cost.slice(1)] : undefined;
        if (!group || !groups[group].every((c) => c in numbers)) {
          errors.push(`${sk.id}/${ex.id}: cost "${ex.cost}" must be a number or a slot whose values are all numbers`);
        }
      }
```

`tools/src/check.ts`, in the per-exchange loop, next to the `pay`/`missCost` check:

```ts
      if (Object.values(ex.variants).some((v) => v.cost !== undefined && !isCount(v.cost))) {
        errors.push(`${s.id}/${ex.id}: cost must be a whole number of 0 or more`);
      }
```

`tools/src/bots.ts`:
- Import `sceneCost` from `@silver-tongue/core`.
- In `goals`, skip any scene whose price would leave less than a week's rent:
  ```ts
  const out: Goal[] = availableSceneIds(course, state)
    // Shopping never eats into the rent money.
    .filter((id) => {
      const cost = sceneCost(course.scenes.find((s) => s.id === id)!);
      return cost === 0 || state.wallet - cost >= course.world.rentPerWeek;
    })
    .map((id) => { … existing body … });
  ```
- The rank rule stays as it is. A shop scene has no pay, so it is rank 3 (practice), or rank 0 while it is still a first visit.

`content/learner/en/ui.ftl`, after `reason-rent = rent`:
```ftl
reason-shopping = shopping
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npm run typecheck && npm run build:course`
Expected: PASS. The build is unchanged, since no content has a cost yet.

- [ ] **Step 5: Commit**

```bash
git add tools content/learner/en/ui.ftl packages/tui
git commit -m "tools: the build resolves costs per variant, the checker wants whole numbers, bots never shop into the rent; the screen says 'shopping'"
```

---

### Task 3: Kitchen and shop content

**Files:**
- Modify: `content/settings/china-city/world.json`, `groups.json`
- Create: `content/settings/china-city/scenes/{noodle-kitchen,shop-intro,shop-buy}.json`
- Create: `content/languages/zh/lines/{noodle-kitchen,shop-intro,shop-buy}.ftl`, `content/learner/en/lines-zh/{same}.ftl`
- Modify: `content/languages/zh/terms.ftl`, `content/learner/en/terms.ftl`, `narration-china-city.ftl`, `content/languages/zh/notes.json`, `content/learner/en/mentor-zh.ftl`
- Test: `tools/test/build-course.test.ts`

- [ ] **Step 1: Write the failing content tests**

In `tools/test/build-course.test.ts`:
- **Pinned scene list:** add `"noodle-kitchen"` after `"noodle-intro"` and before `"noodle-shift"` (the list is sorted by file name), and add `"shop-buy"` and `"shop-intro"` after `"room-rent"`.
- **Pinned notes list:** append `"mei", "tai"`.
- **Map test:** market links become `["room", "shop", "station_road", "street", "warehouse"]`, and the count becomes `7`.
- **New test:**

```ts
  it("the shop sells at the price you agreed, and the kitchen comes after deliveries", () => {
    const buy = course!.scenes.find((s) => s.id === "shop-buy")!;
    expect(buy.exchanges[0].variants["item=apple|price=four"].cost).toBe(4);
    const intro = course!.scenes.find((s) => s.id === "shop-intro")!;
    expect(intro.exchanges.find((ex) => ex.id === "less")!.variants[""].cost).toBe(4);
    expect(course!.scenes.find((s) => s.id === "noodle-kitchen")!.after).toEqual(["noodle-shift", "delivery-pickup"]);
  });
```

Run: `npx vitest run tools/test/build-course.test.ts`
Expected: the changed and new tests FAIL.

- [ ] **Step 2: World, groups, terms**

`world.json`:
- `places.market.links` gains `"shop"` at the end.
- Add `"shop": { "links": ["market"] }`.
- Add the npc `"shopkeeper": { "place": "shop" }`.

`groups.json` gains:
```json
    "foods": ["rice", "dishes", "noodles"],
    "goods": ["apple", "cup", "book"]
```

`content/languages/zh/terms.ftl`, append:
```ftl
-rice = 米饭
-dishes = 菜
-noodles = 面条
-apple = 苹果
-cup = 杯子
-book = 书
```

`content/learner/en/terms.ftl`, append six entries in this shape, for rice/Rice, dishes/Dishes, noodles/Noodles, apple/Apple, cup/Cup and book/Book:
```ftl
-rice = { $form ->
    [cap] Rice
   *[base] rice
}
```

- [ ] **Step 3: Scene skeletons**

`scenes/noodle-kitchen.json`:
```json
{
  "id": "noodle-kitchen",
  "place": "noodle_shop",
  "npc": "cook",
  "stage": 1,
  "after": ["noodle-shift", "delivery-pickup"],
  "requires": { "trust": { "cook": 2 } },
  "repeatable": true,
  "trustGain": 1,
  "exchanges": [
    { "id": "cups", "slots": { "amount": "numbers_3_10" }, "expect": { "action": "wash", "amount": "$amount" }, "hinges": ["$amount"], "pay": 2, "missCost": 1 },
    { "id": "lunch", "slots": { "food": "foods" }, "expect": { "action": "eat", "food": "$food" }, "hinges": ["$food"], "pay": 1, "missCost": 1 },
    { "id": "out", "slots": {}, "expect": { "action": "out" }, "hinges": [], "pay": 2, "missCost": 0 }
  ]
}
```

`scenes/shop-intro.json`:
```json
{
  "id": "shop-intro",
  "place": "shop",
  "npc": "shopkeeper",
  "stage": 1,
  "after": ["noodle-kitchen", "room-rent"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "greet", "slots": {}, "expect": { "action": "browse" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "fruit", "slots": {}, "expect": { "action": "fruit" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "apples", "slots": {}, "expect": { "action": "apples" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "price", "slots": {}, "expect": { "action": "haggle" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "less", "slots": {}, "expect": { "action": "less" }, "hinges": [], "pay": 0, "missCost": 0, "cost": 4 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

`scenes/shop-buy.json`:
```json
{
  "id": "shop-buy",
  "place": "shop",
  "npc": "shopkeeper",
  "stage": 1,
  "after": ["shop-intro"],
  "requires": { "trust": { "shopkeeper": 1 } },
  "repeatable": true,
  "trustGain": 1,
  "exchanges": [
    {
      "id": "buy",
      "slots": { "item": "goods", "price": "numbers_3_5" },
      "expect": { "action": "buy", "item": "$item", "price": "$price" },
      "hinges": ["$item", "$price"],
      "pay": 0,
      "missCost": 0,
      "cost": "$price"
    },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

- [ ] **Step 4: Chinese lines** (`content/languages/zh/lines/`)

`noodle-kitchen.ftl`:
```ftl
# The cook's kitchen: wash cups, eat the staff lunch, and go out for more cups.

cups = 杯子！{ -amount }个！
cups-reply = 好，{ -amount }个杯子！
cups-rephrase = { -amount }个！杯子！

lunch = 中午了！你吃{ -food }吗？
lunch-reply = 好，我吃{ -food }！
lunch-rephrase = { -food }，你吃吗？

out = 杯子没有了！
out-reply = 我去买杯子。
out-alt1 = 我现在去！
out-alt2 = 好，我吃面条！
```

`shop-intro.ftl`:
```ftl
# The shopkeeper, the apples, and a price talked down by one kuai. Wrong replies use only words met by then.

greet = 你好！你买什么？
greet-reply = 我看看。
greet-alt1 = 我去买杯子。
greet-alt2 = 在医院前面。

fruit = 好。这些是水果。
fruit-reply = 水果！很好。
fruit-alt1 = 杯子没有了！
fruit-alt2 = 我现在去！

apples = 这个苹果很好！
apples-reply = 我喜欢苹果。
apples-alt1 = 我喜欢面条。
apples-alt2 = 学校在哪里？

price = 一个苹果，五块。
price-reply = 五块？太多了！
price-alt1 = 好，五块。
price-alt2 = 我饿了。

less = 好，少一块。四块。
less-reply = 好，我买一个。
less-alt1 = 太多了！
less-alt2 = 再见！

bye = 谢谢！再见！
bye-reply = 再见！
bye-alt1 = 你买什么？
bye-alt2 = 我看看。
```

`shop-buy.ftl`:
```ftl
buy = { -item }？{ -price }块。
buy-reply = 好，{ -price }块。
buy-rephrase = { -price }块，{ -item }。

bye = 谢谢！
bye-reply = 不客气！再见！
bye-alt1 = 太多了！
bye-alt2 = 我看看。
```

- [ ] **Step 5: English meanings** (`content/learner/en/lines-zh/`)

`noodle-kitchen.ftl`:
```ftl
cups = Cups! { -amount(form: "cap") } of them!
cups-reply = OK, { -amount } cups!
cups-rephrase = { -amount(form: "cap") }! Cups!

lunch = It's noon! Will you eat { -food }?
lunch-reply = OK, I'll eat { -food }!
lunch-rephrase = { -food(form: "cap") }, will you eat some?

out = We're out of cups!
out-reply = I'll go and buy cups.
out-alt1 = I'm going now!
out-alt2 = OK, I'll eat noodles!
```

`shop-intro.ftl`:
```ftl
greet = Hello! What are you buying?
greet-reply = I'm just looking.
greet-alt1 = I'll go and buy cups.
greet-alt2 = In front of the hospital.

fruit = OK. These are fruit.
fruit-reply = Fruit! Very good.
fruit-alt1 = We're out of cups!
fruit-alt2 = I'm going now!

apples = This apple is very good!
apples-reply = I like apples.
apples-alt1 = I like noodles.
apples-alt2 = Where is the school?

price = One apple, five kuai.
price-reply = Five kuai? That's too much!
price-alt1 = OK, five kuai.
price-alt2 = I'm hungry.

less = Fine, one kuai less. Four kuai.
less-reply = OK, I'll buy one.
less-alt1 = That's too much!
less-alt2 = Goodbye!

bye = Thank you! Goodbye!
bye-reply = Goodbye!
bye-alt1 = What are you buying?
bye-alt2 = I'm just looking.
```

`shop-buy.ftl`:
```ftl
buy = { -item(form: "cap") }? { -price(form: "cap") } kuai.
buy-reply = OK, { -price } kuai.
buy-rephrase = { -price(form: "cap") } kuai for the { -item }.

bye = Thank you!
bye-reply = You're welcome! Goodbye!
bye-alt1 = That's too much!
bye-alt2 = I'm just looking.
```

- [ ] **Step 6: Narration** (`narration-china-city.ftl`)

Insert before `place-warehouse = Warehouse`:
```ftl
place-shop = Corner Shop
place-shop-desc = Shelves to the ceiling, a crate of apples by the door, and a shopkeeper who misses nothing.
```

After `npc-traveller = Traveller`:
```ftl
npc-shopkeeper = Shopkeeper
```

Before `# What a reply does`:
```ftl
scene-noodle-kitchen = Wash dishes
scene-noodle-kitchen-start = The sink is full, and the cook needs clean cups faster than you can wash them.
scene-noodle-kitchen-end = The last cup is dry. The cook pays you and points you at the door: cups, from the shop.
scene-shop-intro = Meet the shopkeeper
scene-shop-intro-start = The shopkeeper looks up from her abacus as you come in.
scene-shop-intro-end = You leave with one apple, and the feeling you paid too much anyway.
scene-shop-buy = Buy something
scene-shop-buy-start = The shopkeeper holds something up and names a price.
scene-shop-buy-end = She wraps it in newspaper and drops the coins in a tin.
```

Append:
```ftl
action-wash = You wash { $amount } cups.
asked-wash = They wanted { $amount } cups.
action-eat = You eat { $food }.
asked-eat = They were offering you { $food }.
asked-out = They're out of cups.
asked-browse = They wanted to know what you're buying.
asked-fruit = They were showing you the fruit.
asked-apples = They were saying the apples are good.
asked-haggle = They told you the price: five kuai for one apple.
asked-less = They offered it for one kuai less.
action-buy = You pay { $price } kuai for the { $item }.
asked-buy = They wanted { $price } kuai for the { $item }.
```

- [ ] **Step 7: Mentor notes**

`notes.json`, append after `dian`:
```json
  { "id": "mei", "trigger": { "word": "w0111" } },
  { "id": "tai", "trigger": { "word": "w0069" } }
```

`mentor-zh.ftl`, append:
```ftl

note-mei-title = 没有, there isn't
note-mei = 没有 (méiyǒu) is "don't have" or "there isn't": 杯子没有了 is "we're out of cups". Most verbs take 不 for "not", but 有 always takes 没: 没有, never 不有.

note-tai-title = 太…了, too much
note-tai = 太 (tài) … 了 means "too …": 太多了 is "that's too much". The 了 at the end is part of the pattern.
```

- [ ] **Step 8: Build and run the tests**

Run: `npm run build:course && npx vitest run && npm run typecheck && npm run bots`
Expected:
- 18 scenes, no checker errors, all tests pass.
- Every bot: `rejected 0`, `dead-end days 0`, `broke without work 0`, `notes 12/12`.
- The right-answer bot finishes every one-off scene, including `shop-intro`. If it can't (because `shop-intro` needs ¥4 with a week's rent spare), rule on the smallest fix, e.g. letting a one-off (rank 0) shop scene skip the rent rule. Ledger it, and don't loosen the test.

- [ ] **Step 9: Commit**

```bash
git add content tools/test
git commit -m "content: the cook's kitchen (杯子, 中午, 米饭, 没有, 买) and the corner shop (看, 水果, 苹果, 太…了, 少); notes on 没有 and 太"
```

---

### Task 4: Verify, play, review, release

- [ ] **Step 1: Full verification**

Run: `npx vitest run; npm run typecheck && npm run build:course && npm run bots && npm run build:web`
Expected: everything passes.

- [ ] **Step 2: Play the real course**

- **Scripted:** use a temporary `tools/src/zz-play.ts` driving `startApp` with `FakeTerminal` at 46×30 (phone width), starting from a state after `delivery-pickup` with cook trust 2. Check that:
  - the kitchen shift pays;
  - "Meet the shopkeeper" appears and charges ¥4 on 好，我买一个。, shown as "-¥4 (shopping)";
  - "Buy something" charges the price said;
  - a wrong pick in the shop costs nothing;
  - Market Street shows 7 items.

  Delete the script afterwards.
- **Terminal:** run the bundle in a pty as a smoke test.
- **Fixes:** fix anything broken test-first, each as a ruling.

- [ ] **Step 3: Review**

Build the review package and dispatch one opus reviewer with the spec, this plan, the Review Focus and the ledger rulings. Fix every finding, minors included, test-first.

- [ ] **Step 4: Release 0.10.0**

- Bump the version to `0.10.0` and run `npm install --package-lock-only`.
- Commit `release: 0.10.0`.
- Then:
  ```bash
  git checkout main && git merge --no-ff b3-2c-kitchen-shop -m "Merge branch 'b3-2c-kitchen-shop': the kitchen and the corner shop (0.10.0)" && git push origin main
  ```
- Watch `ci`, `publish` and `pages` until they succeed, and confirm that `npm view silver-tongue version` prints `0.10.0`.

- [ ] **Step 5: After the release**

- **Progress artifact:**
  - set version 0.10.0 and the date;
  - mark 2c Done and slice 3 Next;
  - add a 0.10.0 row with the new words: 杯子 中午 米饭 菜 没 买 · 看 些 水果 苹果 太 多 少.
- **Memory:** update the status memory.
- **Cleanup:** delete the workspace and the branch.
- **Report:** tell the user briefly.
