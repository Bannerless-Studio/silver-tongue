# B3 slice 1: life structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A room you sleep in, a landlord to meet, counting 一–五 with Old Wang before the noodle shift, and an `asked-` narration line for every action, released as `silver-tongue@0.7.0`.

**Architecture:** One additive core rule (`world.home` plus reject reason `not-home`). Three checker rules. The bots walk home to sleep and count refused inputs. Everything else is content: Fluent lines, scene skeletons and world JSON. The two scenes' lines below were drafted and built against the real checker and bots before this plan was written.

**Tech Stack:** TypeScript, Vitest, Fluent (`@fluent/syntax`), npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-25-b3-1-life-structure-design.md`

## Global Constraints

- `Input` and `GameEvent` change only additively. `RejectReason` gains `"not-home"`, `World` gains `home?: string`. Nothing is removed or renamed.
- No save-schema change. `SAVE_VERSION` stays 1.
- Core stays free of I/O and rendering.
- Run `npm run build:course` after any change under `content/`, and never commit content with checker errors.
- Never edit generated files: `content/languages/zh/words.json`, `content/languages/zh/pack.json` (except `stages`), `content/learner/en/glosses-zh.ftl`, `dist/`.
- Bonus words go in `content/languages/zh/extra-words.json`, with glosses in `content/learner/en/glosses-zh-extra.ftl`.
- Every UI string the TUI uses is in `packages/tui/src/text.ts` `UI_KEYS`. The `reject-<reason>` keys are generated from `REJECT_REASONS`.
- An `asked-<action>` line may name an NPC only if one NPC uses that action. Otherwise it says "they".
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4
  ```
- Work on branch `b3-life-structure`. The spec is already committed there.

## Review Focus

1. **Out of slots away from home.** A player at the noodle shop with 4/4 slots presses Sleep. They should see "You want your own bed. Head home first.", the day should not end, and the save should not change. Pinned in Task 1 (TUI test).
2. **A save resumed mid-scene whose `after` has changed.** A save in the middle of `noodle-shift` loads after the shift gained `after: street-numbers`. The run should continue: availability is checked only when a scene starts. Pinned in Task 1 (core test).
3. **A bot stuck sending a refused input.** Sleep refused away from home must not spin to the 100,000-step cap. `rejected` must be 0. Pinned in Task 2.
4. **A written wrong reply in a counting exchange.** The player should see `asked-next` with the learner number ("They wanted the next number: three."), not the generic line. `narrationProblems` checks the formatting at build time, and Task 6 step 5 checks the rendered text.
5. **The street menu at exactly 7 items.** It has 2 exits, 4 scenes and the mentor item. Adding one more must fail the checker. Pinned in Task 4.

(An older CLI reading a save made in `room` would reject it as `bad-place`, and its import backs up and starts over. That can't be tested here. Mention it in the release notes.)

---

### Task 1: Core: sleep only at home

**Files:**
- Modify: `packages/core/src/types.ts` (`World`, `REJECT_REASONS`)
- Modify: `packages/core/src/core.ts` (`case "sleep"`)
- Modify: `content/learner/en/ui.ftl` (after `reject-not-linked`)
- Test: `packages/core/test/core.test.ts`, `packages/tui/test/app.test.ts`

**Interfaces:**
- Produces: `World.home?: string`; reject reason `"not-home"`; UI string `reject-not-home`.

- [ ] **Step 1: Write the failing core tests.** Add these inside `describe("core", …)` in `packages/core/test/core.test.ts`. `fixtureCourse` is already imported from `../src/testing/fixture`.

```ts
  it("sleeps only at home when the course has one", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    const core = createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
    core.send({ type: "goTo", place: "noodle_shop" });
    const before = core.state;
    expect(core.send({ type: "sleep" })).toEqual([{ type: "inputRejected", reason: "not-home" }]);
    expect(core.state).toBe(before);
    core.send({ type: "goTo", place: "street" });
    expect(types(core.send({ type: "sleep" }))).toContain("dayEnded");
    expect(core.state.day).toBe(2);
  });

  it("keeps a running scene going after the course adds to its `after`", () => {
    const core = setup();
    playIntro(core);
    core.send({ type: "startScene", scene: "shift" });
    const c = fixtureCourse();
    c.scenes[1].after = ["intro", "later"];
    const resumed = createCore(c, core.state, { now: () => T0, rng: mulberry32(1) });
    const choice = resumed.state.run!.options.indexOf(comboKey(resumed.state.run!.combo));
    expect(types(resumed.send({ type: "reply", choice }))).not.toContain("inputRejected");
  });
```

The existing test "uses day slots and refuses scenes when they run out" sleeps at the noodle shop with no `home`. It stays as it is: it pins the fallback.

- [ ] **Step 2: Run to see them fail.**

Run: `npx vitest run packages/core/test/core.test.ts`
Expected: FAIL. Typecheck (`npm run typecheck`) reports that `home` doesn't exist on `World`. Vitest fails the first test: sleep ends the day instead of refusing. The second test should already pass. It pins behaviour that must not regress.

- [ ] **Step 3: Implement.** In `packages/core/src/types.ts`, in `World`, add after `mentor?: Mentor;`:

```ts
  /** The place the player sleeps. Without it, sleep works anywhere. */
  home?: string;
```

Add `"not-home",` as the last entry of `REJECT_REASONS` (after `"no-name",`).

In `packages/core/src/core.ts`, replace the `sleep` case:

```ts
    case "sleep":
      if (state.run) return reject(ctx, "in-scene");
      if (course.world.home && state.place !== course.world.home) return reject(ctx, "not-home");
      ctx.ev.push(...endDay(course, state));
      return;
```

In `content/learner/en/ui.ftl`, after `reject-not-linked = …`, add:

```
reject-not-home = You want your own bed. Head home first.
```

- [ ] **Step 4: Write the failing TUI test.** Add this to `packages/tui/test/app.test.ts`, next to "sleeping ends the day". At the noodle shop the menu is 1) the intro scene, 2) go to the street, 3) sleep.

```ts
  it("won't sleep away from home, and says so", () => {
    const { term, core, saves } = setup(
      (s) => (s.place = "noodle_shop"),
      (c) => (c.world.home = "street"),
    );
    const savedBefore = saves.length;
    term.press("3");
    expect(term.screen().join("\n")).toContain("You want your own bed. Head home first.");
    expect(core.state.day).toBe(1);
    expect(saves.length).toBe(savedBefore); // a refused input isn't saved
  });
```

- [ ] **Step 5: Run everything touched.**

Run: `npx vitest run packages/core packages/tui && npm run typecheck && npm run build:course`
Expected: all PASS. The build passes because the real course has no `home` yet.

- [ ] **Step 6: Commit.**

```bash
git add packages/core/src/types.ts packages/core/src/core.ts packages/core/test/core.test.ts packages/tui/test/app.test.ts content/learner/en/ui.ftl
git commit -m "feat(core): sleep only at home when the world has one (not-home)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 2: Bots walk home to sleep and count refused inputs

**Files:**
- Modify: `tools/src/bots.ts` (`BotReport`, `runBot`)
- Test: `tools/test/bots.test.ts`

**Interfaces:**
- Consumes: `World.home` and `"not-home"` from Task 1; the existing `stepToward(course, from, targets): string | undefined` in `tools/src/bots.ts`.
- Produces: `BotReport.rejected: number`.

- [ ] **Step 1: Write the failing tests.** In `tools/test/bots.test.ts`, add `import { fixtureCourse } from "@silver-tongue/core/testing";` at the top. Add this to the existing real-content `describe`:

```ts
  it("the core never refuses a bot's input", () => {
    for (const [name, r] of Object.entries(reports)) expect(r.rejected, name).toBe(0);
  });
```

Then add a new block at the end of the file:

```ts
describe("course bots (a world with a home)", () => {
  it("walk home to sleep, so every day ends and nothing is refused", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    for (const [name, bot] of Object.entries(BOTS)) {
      const r = runBot(c, bot, { days: 3, seed: 7 });
      expect(r.rejected, name).toBe(0);
      expect(r.firstDone.intro, name).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run to see them fail.**

Run: `npx vitest run tools/test/bots.test.ts`
Expected: FAIL. `rejected` is `undefined`. After Step 3's first half it becomes large in the home test, because bots sleep at the noodle shop.

- [ ] **Step 3: Implement.** In `tools/src/bots.ts`, add to `BotReport` after `endWallet: number;`:

```ts
  /** inputs the core refused; a sensible player never sends one */
  rejected: number;
```

Add `rejected: 0,` to the `report` initialiser in `runBot`. Then, in the step loop, replace everything from `let input: Input = { type: "sleep" };` through the `for (const e of core.send(input)) {` line with:

```ts
    let input: Input = { type: "sleep" };
    const wanted = goals(course, s);
    const best = wanted.filter((g) => g.rank === wanted[0]?.rank);
    const here = best.find((g) => g.place === s.place);
    if (s.run) input = replyInput(course, s, bot.answerRight(s.run, rng), rng);
    else if (s.slot < course.world.slotsPerDay && best.length) {
      const step = here ? undefined : stepToward(course, s.place, new Set(best.map((g) => g.place)));
      if (here) input = here.input;
      else if (step) input = { type: "goTo", place: step };
    }
    // Bed is at home: walk there before sleeping.
    const home = course.world.home;
    if (input.type === "sleep" && home && s.place !== home) {
      const step = stepToward(course, s.place, new Set([home]));
      if (step) input = { type: "goTo", place: step };
    }
    clock += HOUR;
    const events = core.send(input);
    if (events.some((e) => e.type === "inputRejected")) report.rejected += 1;
    for (const e of events) {
```

Also update the doc comment above `runBot` to: `sleep (at home, walking there first) when out of slots or goals.`

In `main()`, append ``` · rejected ${r.rejected}``` to the first `console.log` line.

- [ ] **Step 4: Run.**

Run: `npx vitest run tools/test/bots.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add tools/src/bots.ts tools/test/bots.test.ts
git commit -m "feat(bots): walk home to sleep; count inputs the core refuses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 3: `asked-` narration for every existing action

**Files:**
- Modify: `content/learner/en/narration-china-city.ftl` (end of file, after `asked-serve`)

**Interfaces:**
- Produces: `asked-<action>` messages for the 18 conversational actions. Task 4's checker rule needs them to exist.

Actions and their parameters come from `content/settings/china-city/scenes/*.json`. `answer` takes `said` (a courtesy concept, arriving as its English base name, e.g. "Thank you"). The others take none.

- [ ] **Step 1: Add the lines.** Append to `content/learner/en/narration-china-city.ftl`:

```
# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-hello = They were saying hello.
asked-greet = They were saying hello.
asked-wang = They were telling you their name.
asked-how = They wanted to know how you are.
asked-name = They were telling you what to call them.
asked-ask = They wanted your name.
asked-names = They told you their name and wanted yours.
asked-bye = They were saying goodbye.
asked-farewell = They were saying goodbye.
asked-answer = They said "{ $said }" and wanted the usual answer.
asked-hungry = They asked how you are, and your stomach has an answer.
asked-noodles = They were offering you noodles.
asked-like = They wanted to know if you like noodles.
asked-there = They were pointing somewhere.
asked-shop = They were telling you there's a restaurant over there.
asked-zhang = They said a name.
asked-friend = They were telling you about a friend.
asked-job = They were offering you work.
```

- [ ] **Step 2: Build.**

Run: `npm run build:course`
Expected: `built zh-china-en: 5 scenes`. The build formats each `asked-` line with its action's parameters (`narrationProblems`), so a typo like `{ $sad }` fails here.

- [ ] **Step 3: Commit.**

```bash
git add content/learner/en/narration-china-city.ftl
git commit -m "content: say what was asked after a wrong reply, in every conversation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 4: Checker: asked- lines, home, mentor in the menu count

**Files:**
- Modify: `tools/src/check.ts` (world section around the `MAX_PLACE_ITEMS` loop; the `need` section at the end)
- Test: `tools/test/check.test.ts`

**Interfaces:**
- Consumes: `World.home` (Task 1); the `asked-` lines (Task 3), so the real course keeps passing.
- Produces: the error texts below. Later content must satisfy them.

- [ ] **Step 1: Write the failing tests.** In `tools/test/check.test.ts`, extend `LEARNER` with the fixture's three actions (`greet`, `repeat`, `serve`) so the fixture keeps passing:

```ts
const LEARNER = [
  "place-street", "place-street-desc", "place-noodle_shop", "place-noodle_shop-desc",
  "npc-cook", "scene-intro", "scene-shift", "hud",
  "asked-greet", "asked-repeat", "asked-serve",
];
```

Change the existing menu test's expectation from `'world: place "noodle_shop" has 8 scenes and exits; at most 7'` to `'world: place "noodle_shop" has 8 menu items; at most 7'`. Then add:

```ts
  it("needs an asked- line for every action a scene uses", () => {
    const learnerIds = new Set(LEARNER.filter((id) => id !== "asked-serve"));
    expect(checkCourse(input({ learnerIds }))).toContain('narration: no "asked-serve" line (used by shift)');
  });

  it("needs home to be a place", () => {
    const c = fixtureCourse();
    c.world.home = "street";
    expect(checkCourse(input({ course: c }))).toEqual([]);
    c.world.home = "attic";
    expect(checkCourse(input({ course: c }))).toContain('world: home "attic" is not a place');
  });

  it("counts the mentor's visit in their place's menu", () => {
    const c = fixtureCourse();
    // 2 scenes + 5 exits = 7: allowed, until the mentor sits here too.
    const extra = ["a", "b", "c", "d"];
    c.world.places.noodle_shop.links = ["street", ...extra];
    for (const l of extra) c.world.places[l] = { links: [] };
    const learnerIds = new Set([...LEARNER, ...extra.flatMap((l) => [`place-${l}`, `place-${l}-desc`])]);
    expect(checkCourse(input({ course: c, learnerIds }))).toEqual([]);
    c.world.mentor = { npc: "cook", after: "intro" };
    expect(checkCourse(input({ course: c, learnerIds }))).toContain('world: place "noodle_shop" has 8 menu items; at most 7');
  });
```

- [ ] **Step 2: Run to see them fail.**

Run: `npx vitest run tools/test/check.test.ts`
Expected: FAIL on the three new tests and the changed message.

- [ ] **Step 3: Implement.** In `tools/src/check.ts`, replace the menu-count loop with:

```ts
  for (const [id, p] of Object.entries(world.places)) {
    // The mentor's visit is an item too, at the mentor's place.
    const mentorItem = world.mentor && world.npcs[world.mentor.npc]?.place === id ? 1 : 0;
    const items = p.links.length + course.scenes.filter((s) => s.place === id).length + mentorItem;
    if (items > MAX_PLACE_ITEMS) errors.push(`world: place "${id}" has ${items} menu items; at most ${MAX_PLACE_ITEMS}`);
  }
  if (world.home !== undefined && !world.places[world.home]) errors.push(`world: home "${world.home}" is not a place`);
```

Update the `MAX_PLACE_ITEMS` doc comment to: `/** A place's menu: its scenes, exits and the mentor's visit on keys 1-7, then sleep and quit. */`

Before the `const need = [` block at the end, add:

```ts
  // Every action says what was asked after a wrong reply (asked-<action>), so no scene falls back
  // to the generic line.
  const actionScene = new Map<string, string>();
  for (const s of course.scenes) for (const ex of s.exchanges) if (!actionScene.has(ex.expect.action)) actionScene.set(ex.expect.action, s.id);
  for (const [action, scene] of actionScene) {
    if (!learnerIds.has(`asked-${action}`)) errors.push(`narration: no "asked-${action}" line (used by ${scene})`);
  }
```

- [ ] **Step 4: Run.**

Run: `npx vitest run tools && npm run typecheck && npm run build:course`
Expected: all PASS. The real course has every `asked-` line from Task 3, and the street has 1 exit + 3 scenes + mentor = 5.

- [ ] **Step 5: Commit.**

```bash
git add tools/src/check.ts tools/test/check.test.ts
git commit -m "feat(check): asked- line per action, home is a place, mentor counts in the menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 5: The room and Mr Li, the landlord

**Files:**
- Modify: `content/settings/china-city/world.json`
- Create: `content/settings/china-city/scenes/room-hello.json`
- Create: `content/languages/zh/lines/room-hello.ftl`
- Create: `content/learner/en/lines-zh/room-hello.ftl`
- Modify: `content/languages/zh/extra-words.json`, `content/learner/en/glosses-zh-extra.ftl`
- Modify: `content/learner/en/narration-china-city.ftl`

**Interfaces:**
- Consumes: `home` (Task 1), the checker (Task 4), bots walking home (Task 2).
- Produces: place `room`, NPC `landlord`, scene `room-hello`, action `live`, word `x0005` (李先生).

- [ ] **Step 1: World.** Replace `content/settings/china-city/world.json` with:

```json
{
  "start": "street",
  "home": "room",
  "currency": "¥",
  "slotsPerDay": 4,
  "startWallet": 20,
  "foodPerDay": 5,
  "rentPerWeek": 50,
  "places": {
    "street": {
      "links": [
        "noodle_shop",
        "room"
      ]
    },
    "noodle_shop": {
      "links": [
        "street"
      ]
    },
    "room": {
      "links": [
        "street"
      ]
    }
  },
  "npcs": {
    "wang": {
      "place": "street"
    },
    "cook": {
      "place": "noodle_shop"
    },
    "landlord": {
      "place": "room"
    }
  },
  "mentor": {
    "npc": "wang",
    "after": "street-hello"
  }
}
```

- [ ] **Step 2: The landlord's name.** In `content/languages/zh/extra-words.json`, append to the array:

```json
  { "id": "x0005", "w": "李先生", "lv": "1", "pron": "Lǐ xiānsheng" }
```

Append to `content/learner/en/glosses-zh-extra.ftl`:

```
x0005 = Mr Li, your landlord (the surname Li + 先生 "Mr")
```

- [ ] **Step 3: The scene skeleton.** Create `content/settings/china-city/scenes/room-hello.json`. It comes after `street-hungry`, because 你住这里 is tagged 住 + 这 + 里, and 里 is first met there.

```json
{
  "id": "room-hello",
  "place": "room",
  "npc": "landlord",
  "stage": 1,
  "after": ["street-hungry"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "greet", "slots": {}, "expect": { "action": "greet" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "names", "slots": {}, "expect": { "action": "names" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "how", "slots": {}, "expect": { "action": "how" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "live", "slots": {}, "expect": { "action": "live" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

- [ ] **Step 4: The Chinese lines.** Create `content/languages/zh/lines/room-hello.ftl`:

```
# Meet the landlord: names, and the room is yours. Wrong replies use only words met by then.

greet = 你好！
greet-reply = 你好！你叫什么名字？
greet-alt1 = 再见！
greet-alt2 = 我饿了。

names = 叫我李先生。你呢？
names-reply = 我叫{ $player }。
names-alt1 = 我叫老王。
names-alt2 = 我喜欢面条。

how = 你好吗？
how-reply = 很好！你好吗？
how-alt1 = 我叫{ $player }。
how-alt2 = 再见！

live = 你住这里。
live-reply = 好！谢谢！
live-alt1 = 我饿了。
live-alt2 = 小张是我朋友。

bye = 再见，{ $player }！
bye-reply = 谢谢！再见，李先生！
bye-alt1 = 你好，李先生！
bye-alt2 = 我叫{ $player }。
```

- [ ] **Step 5: The English meanings.** Create `content/learner/en/lines-zh/room-hello.ftl`:

```
greet = Hello!
greet-reply = Hello! What's your name?
greet-alt1 = Goodbye!
greet-alt2 = I'm hungry.

names = Call me Mr Li. And you?
names-reply = My name is { $player }.
names-alt1 = My name is Old Wang.
names-alt2 = I like noodles.

how = How are you?
how-reply = Very well! How are you?
how-alt1 = My name is { $player }.
how-alt2 = Goodbye!

live = You live here.
live-reply = Great! Thank you!
live-alt1 = I'm hungry.
live-alt2 = Xiao Zhang is my friend.

bye = Goodbye, { $player }!
bye-reply = Thank you! Goodbye, Mr Li!
bye-alt1 = Hello, Mr Li!
bye-alt2 = My name is { $player }.
```

- [ ] **Step 6: Narration.** In `content/learner/en/narration-china-city.ftl`:

Replace `intro-3` with:

```
intro-3 = Food costs money. There's a room for you down the street, { $currency }{ $rent } a week, due at the end of the week. To earn anything you'll need work, and for work you'll need words.
```

Replace `place-street-desc` with:

```
place-street-desc = Bikes, steam and shouting. An old man sits on a bench by the road. Across it, a noodle shop glows, and a little way down is your room.
```

After the `place-noodle_shop-desc` line, add:

```
place-room = Your Room
place-room-desc = A narrow bed and a window onto the street. The landlord seems to hear every step on the stairs.
```

After `npc-cook = Cook`, add `npc-landlord = Mr Li`.

After the `scene-noodle-shift-end` line, add:

```
scene-room-hello = Meet the landlord
scene-room-hello-start = A thin man in slippers opens the door before you knock. He has clearly been expecting you.
scene-room-hello-end = Mr Li hands you a key on a red string, and points firmly at the bed. You'll sleep here.
```

Append to the conversations block from Task 3:

```
asked-live = They were telling you this room is yours.
```

- [ ] **Step 7: Build, test, and look at the result.**

Run: `npm run build:course && npx vitest run && npm run typecheck && npm run bots`
Expected: `built zh-china-en: 6 scenes`. All tests PASS. The bots print `rejected 0`, `dead-end days 0` and `notes 5/5` for all four players, and `room-hello` is first done on day 1 or 2.

- [ ] **Step 8: Commit.**

```bash
git add content/
git commit -m "content: your room and Mr Li, the landlord; sleep at home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 6: Count with Old Wang, before the noodle shift

**Files:**
- Create: `content/settings/china-city/scenes/street-numbers.json`
- Create: `content/languages/zh/lines/street-numbers.ftl`
- Create: `content/learner/en/lines-zh/street-numbers.ftl`
- Modify: `content/settings/china-city/groups.json`, `content/settings/china-city/scenes/noodle-shift.json`
- Modify: `content/languages/zh/terms.ftl`, `content/learner/en/terms.ftl`, `content/learner/en/narration-china-city.ftl`

**Interfaces:**
- Consumes: the checker (Task 4).
- Produces: scene `street-numbers`, group `numbers_2_5`, concept `two`, actions `numbers` and `next`.

- [ ] **Step 1: Groups and terms.** Replace `content/settings/china-city/groups.json` with:

```json
{
  "groups": {
    "courtesies": ["hello", "thanks", "sorry"],
    "drinks": ["tea", "water"],
    "numbers_2_5": ["two", "three", "four", "five"],
    "numbers_3_5": ["three", "four", "five"]
  },
  "numbers": {
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5
  }
}
```

In `content/languages/zh/terms.ftl`, add `-two = 二` on the line before `-three = 三`. In `content/learner/en/terms.ftl`, add this before the `-three` block:

```
-two = { $form ->
    [cap] Two
   *[base] two
}
```

- [ ] **Step 2: The scene skeleton.** Create `content/settings/china-city/scenes/street-numbers.json`:

```json
{
  "id": "street-numbers",
  "place": "street",
  "npc": "wang",
  "stage": 1,
  "after": ["street-hungry"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "one-two", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "three-four", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "five", "slots": {}, "expect": { "action": "numbers" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "next-a", "slots": { "count": "numbers_2_5" }, "expect": { "action": "next", "count": "$count" }, "hinges": ["$count"], "pay": 0, "missCost": 0 },
    { "id": "next-b", "slots": { "count": "numbers_2_5" }, "expect": { "action": "next", "count": "$count" }, "hinges": ["$count"], "pay": 0, "missCost": 0 }
  ]
}
```

In `content/settings/china-city/scenes/noodle-shift.json`, change `"after": ["noodle-intro"]` to `"after": ["noodle-intro", "street-numbers"]`.

- [ ] **Step 3: The Chinese lines.** Create `content/languages/zh/lines/street-numbers.ftl`. `$count` is the slot's number (the build passes it from `groups.json` `numbers`), so Old Wang counts up to the number before it and stops.

```
# Old Wang counts on his fingers, then stops for you to say the next number.
# Wrong replies use only words met by then.

one-two = 一，二。
one-two-reply = 一，二。
one-two-alt1 = 再见！
one-two-alt2 = 我饿了。

three-four = 一，二，三，四。
three-four-reply = 一，二，三，四。
three-four-alt1 = 一，二。
three-four-alt2 = 你好吗？

five = 一，二，三，四，五！
five-reply = 一，二，三，四，五！
five-alt1 = 一，二，三，四。
five-alt2 = 很好！

next-a = { $count ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-a-reply = { -count }！

next-b = { $count ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-b-reply = { -count }！
```

- [ ] **Step 4: The English meanings.** Create `content/learner/en/lines-zh/street-numbers.ftl`:

```
one-two = One, two.
one-two-reply = One, two.
one-two-alt1 = Goodbye!
one-two-alt2 = I'm hungry.

three-four = One, two, three, four.
three-four-reply = One, two, three, four.
three-four-alt1 = One, two.
three-four-alt2 = How are you?

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-alt1 = One, two, three, four.
five-alt2 = Very well!

next-a = { $count ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-a-reply = { -count(form: "cap") }!

next-b = { $count ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-b-reply = { -count(form: "cap") }!
```

- [ ] **Step 5: Narration.** In `content/learner/en/narration-china-city.ftl`, after the `scene-street-practice-end` line, add:

```
scene-street-numbers = Count with Old Wang
scene-street-numbers-start = Old Wang holds up one finger, then another. Work at the noodle shop means counting, and he isn't sending you over there unable to count.
scene-street-numbers-end = Old Wang counts your fingers for you, twice, just to be sure. Now the noodle shop.
```

Append to the conversations block:

```
asked-numbers = They wanted you to count along.
asked-next = They wanted the next number: { $count }.
```

- [ ] **Step 6: Build, test, check pacing.**

Run: `npm run build:course && npx vitest run && npm run typecheck && npm run bots`
Expected: `built zh-china-en: 7 scenes`. All tests PASS. When this plan was drafted, the bots showed `street-numbers:1`, `noodle-intro:1`, `room-hello:2` for every player, `dead-end days 0`, `broke without work 0`, `notes 5/5`, and `rejected 0`.

Check the wrong-reply narration for Review Focus 4 by hand in Task 7's terminal play-through: pick a wrong number in `next-a` and see "They wanted the next number: three." (or whichever number).

- [ ] **Step 7: Commit.**

```bash
git add content/
git commit -m "content: count one to five with Old Wang before the noodle shift

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
```

---

### Task 7: Play it, review it, release 0.7.0

**Files:**
- Modify: `packages/tui-node/package.json` (`version`), `package-lock.json`
- Modify: the `silver-tongue-status` memory file (at `~/.claude/projects/-home-jamil-Documents-projects-make-it-china/memory/silver-tongue-status.md`)

- [ ] **Step 1: Full verification.**

Run: `npm run typecheck && npm run build:course && npx vitest run && npm run build:web`
Expected: all PASS. There are more tests than the 181 before this slice.

- [ ] **Step 2: Play in the terminal.** Run `npm run play` in a python pty with `HOME` set to a temp dir. Enter a name, then:
  - meet Old Wang, then talk about food;
  - count, and pick one wrong number on purpose: see `asked-next`;
  - go to the noodle shop and do the intro;
  - spend the last slot, then press Sleep at the noodle shop: see "You want your own bed. Head home first.";
  - walk Street → Your Room;
  - meet Mr Li;
  - sleep: see "Day 1 is over".

  Check that the intro mentions the room and that the street menu fits (7 items, then sleep and quit).

- [ ] **Step 3: Play in the browser.** Run `npm run build:web`. Drive `packages/tui-web/dist/index.html` with the Playwright harness in `/home/jamil/.claude/jobs/91570df1/tmp/pw/` (`smoke.mjs`, and `phone-type.mjs` for the name). Take a phone-size screenshot of the street menu and of the refused sleep.

- [ ] **Step 4: Review.** Dispatch an opus review agent (superpowers:requesting-code-review) on `git diff main...b3-life-structure`, pointing it at the spec and this plan's Review Focus. Fix every Important finding, re-run Step 1, and commit the fixes.

- [ ] **Step 5: Bump and merge.** Set `"version": "0.7.0"` in `packages/tui-node/package.json`, then:

```bash
npm install --package-lock-only
git add packages/tui-node/package.json package-lock.json
git commit -m "release: 0.7.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
git checkout main
git merge --no-ff b3-life-structure -m "Merge branch 'b3-life-structure': your room, the landlord, counting before work (0.7.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4"
git push origin main
```

Pushing publishes to npm (`publish.yml`) and deploys the page (`pages.yml`). Watch both with `gh run list --limit 3`.

- [ ] **Step 6: Record it.** Update the `silver-tongue-status` memory: 0.7.0 is B3 slice 1; slice 2 (jobs and places, numbers 6–10, rent talk) is next. Tell the user in a few lines what they can do in the game now, and what an older installed CLI will do with a save made in the room.
