# B3 slice 2b: deliveries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `silver-tongue@0.9.0`: Miss Gao's delivery job. She names a place in Chinese, and the player walks the parcel there on the map.

**Architecture:**
- **Core:** a scene can start an errand (`startsErrand: "$slot"`, whose value is the destination place) or end one (`endsErrand: true`). The errand is stored in `GameState.errand`. Availability, events, save and the "New:" suppression all live in core.
- **Front ends and tools:** the TUI shows two lines and a status-line marker; the checker validates errands; the bots walk parcels.
- **Content:** Station Road with three destinations, and five new scenes.

**Tech Stack:** TypeScript, Vitest, Fluent (`.ftl`) content, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-26-b3-2bc-deliveries-kitchen-shop-design.md` (Part 1 and §9).

## Global Constraints

- `Input`, `GameEvent`, `RejectReason` and `WalletReason` are additive-only contracts. Only append to them.
- Core stays free of I/O and rendering.
- Every UI string the TUI uses is listed in `packages/tui/src/text.ts` `UI_KEYS`.
- Run `npm run build:course` after any change under `content/`, and never ship checker errors.
- Never edit `content/languages/zh/words.json`, `pack.json` (except `stages`), `glosses-zh.ftl` or `dist/`.
- The checker allows at most 2 new words per exchange, reply ≤ 7 tiles (the name counts), NPC line ≤ 9 words, and ≤ 7 menu items per place. Wrong replies (`-alt<n>`) use only words already met.
- Every action has an `asked-<action>` narration line.
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BbfrEz3c4htez6eMUWaye4
  ```
- **Release:** bump `packages/tui-node/package.json` to `0.9.0`, run `npm install --package-lock-only`, merge `--no-ff` to `main`, and push. Then update the progress artifact https://claude.ai/artifact/MXUS9cc9XHZaMDCi2S13Ws.

## Review Focus

1. **An old 0.8.0 save** (on Market Street, or mid-scene) loads with no errand. Miss Gao appears once her `after` is met. Pinned by the save test in Task 1.
2. **A wrong answer at pickup** (even twice, falling back to pick) still gives a parcel for the place she said. The English `asked-deliver` line names it. Pinned by the Task 1 test "a wrong reply at pickup still sends the parcel where she said".
3. **Sleeping, including rent night, with a parcel** keeps it, and the drop-off is still offered the next day. Pinned by the Task 1 overnight test.
4. **Arriving at the destination with no slots left:** the drop-off is listed but refused with `no-slots`. The next morning it is still there. Pinned by the Task 1 no-slots test.
5. **Phone width:** the status line with "parcel" and "rent due" at 40 columns stays inside the frame. Pinned by the Task 2 width test.

---

### Task 1: The errand in core

**Files:**
- Modify: `packages/core/src/types.ts` (Scene, SceneRun, GameState, GameEvent)
- Modify: `packages/core/src/life.ts` (`isAvailable`)
- Modify: `packages/core/src/dialogue.ts` (`beginExchange`, `finishScene`)
- Modify: `packages/core/src/core.ts` (no `unlocked` for drop-offs)
- Modify: `packages/core/src/save.ts` (errand, `errandTo`)
- Modify: `packages/core/src/testing/fixture.ts` (add `addErrand`)
- Test: `packages/core/test/core.test.ts`, `packages/core/test/save.test.ts`

**Interfaces:**
- Produces:
  - `Scene.startsErrand?: string`, `Scene.endsErrand?: boolean`;
  - `GameState.errand?: { to: string }`, `SceneRun.errandTo?: string`;
  - the events `{ type: "errandStarted"; to: string }` and `{ type: "errandEnded"; to: string }`;
  - `addErrand(course: Course): Course`, exported from `@silver-tongue/core/testing`. It adds place `school` (linked to `street`), npc `teacher` at `school`, concept `school` (word `w_zhe`), group `dests = ["school"]`, a repeatable scene `pickup` at `noodle_shop` (cook, after `intro`, `startsErrand: "$to"`, one exchange `parcel` with action `deliver`) and a repeatable scene `drop` at `school` (teacher, after `pickup`, `endsErrand: true`, one greeting exchange paying 4).

- [ ] **Step 1: Add the fixture helper**

Append to `packages/core/src/testing/fixture.ts` (`comboKey` is already imported):

```ts
/**
 * Adds a delivery: a repeatable pickup at the noodle shop whose `to` slot names the school (a new
 * place off the street), and a repeatable drop-off at the school that ends the errand and pays 4.
 */
export function addErrand(course: Course): Course {
  course.world.places.street.links.push("school");
  course.world.places.school = { links: ["street"] };
  course.world.npcs.teacher = { place: "school" };
  course.concepts.school = ["w_zhe"];
  course.conceptNames.school = "school";
  course.groups.dests = ["school"];
  const hello = structuredClone(course.scenes[0].exchanges[0]);
  course.scenes.push(
    {
      id: "pickup", place: "noodle_shop", npc: "cook", stage: 1, after: ["intro"], requires: {}, repeatable: true, trustGain: 1,
      startsErrand: "$to",
      exchanges: [
        {
          id: "parcel", slots: { to: "dests" }, expect: { action: "deliver", to: "$to" }, hinges: ["$to"], pay: 0, missCost: 1,
          variants: {
            [comboKey({ to: "school" })]: {
              npc: line(["这", "w_zhe"], ["。", null]),
              reply: line(["好", "w_hao"], ["，", null], ["这", "w_zhe"], ["。", null]),
              alts: [line(["你", "w_ni"], ["好", "w_hao"], ["！", null])],
            },
          },
        },
      ],
    },
    {
      id: "drop", place: "school", npc: "teacher", stage: 1, after: ["pickup"], requires: {}, repeatable: true, trustGain: 1,
      endsErrand: true, exchanges: [{ ...hello, pay: 4 }],
    },
  );
  return course;
}
```

- [ ] **Step 2: Write the failing core tests**

In `packages/core/test/core.test.ts`:
- Add `addErrand` to the fixture import.
- Add `import { availableSceneIds } from "../src/life";` and `import { tilePieces } from "../src/dialogue";`.
- Append this block:

```ts
describe("errands", () => {
  const c = addErrand(fixtureCourse());
  const start = () => createCore(c, newGame(c), { now: () => T0, rng: mulberry32(1) });
  /** Answers the current exchange right, in pick or tiles mode. */
  const answer = (core: Core) => {
    const run = core.state.run!;
    if (run.mode === "pick") return core.send({ type: "reply", choice: run.options.indexOf(comboKey(run.combo)) });
    const ex = c.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange];
    const used = new Set<number>();
    const tiles = tilePieces(ex.variants[comboKey(run.combo)].reply).map((p) => {
      const i = run.tiles.findIndex((t, j) => t === p && !used.has(j));
      used.add(i);
      return i;
    });
    return core.send({ type: "replyTiles", tiles });
  };
  const play = (core: Core, scene: string) => {
    const ev = [...core.send({ type: "startScene", scene })];
    while (core.state.run) ev.push(...answer(core));
    return ev;
  };
  const pickedUp = () => {
    const core = start();
    core.send({ type: "goTo", place: "noodle_shop" });
    play(core, "intro");
    const ev = play(core, "pickup");
    return { core, ev };
  };
  const walkToSchool = (core: Core) => {
    core.send({ type: "goTo", place: "street" });
    core.send({ type: "goTo", place: "school" });
  };

  it("a pickup starts an errand to the place its slot named, with no unlock line for the drop-off", () => {
    const { core, ev } = pickedUp();
    expect(core.state.errand).toEqual({ to: "school" });
    expect(find(ev, "errandStarted")).toEqual({ type: "errandStarted", to: "school" });
    expect(ev.filter((e) => e.type === "unlocked")).toEqual([]);
  });

  it("a wrong reply at pickup still sends the parcel where she said", () => {
    const core = start();
    core.send({ type: "goTo", place: "noodle_shop" });
    play(core, "intro");
    core.send({ type: "startScene", scene: "pickup" });
    const wrong = core.state.run!.options.findIndex((k) => k !== comboKey(core.state.run!.combo));
    expect(types(core.send({ type: "reply", choice: wrong }))).toContain("npcReacted");
    while (core.state.run) answer(core);
    expect(core.state.errand).toEqual({ to: "school" });
  });

  it("carries one parcel at a time", () => {
    const { core } = pickedUp();
    expect(availableSceneIds(c, core.state)).not.toContain("pickup");
    expect(core.send({ type: "startScene", scene: "pickup" })).toEqual([{ type: "inputRejected", reason: "locked" }]);
  });

  it("offers the drop-off only while a parcel is for its place", () => {
    const empty = start();
    empty.send({ type: "goTo", place: "noodle_shop" });
    play(empty, "intro");
    expect(availableSceneIds(c, empty.state)).not.toContain("drop");
    const { core } = pickedUp();
    expect(availableSceneIds(c, core.state)).toContain("drop");
  });

  it("delivering pays, ends the errand, and opens the pickup again", () => {
    const { core } = pickedUp();
    walkToSchool(core);
    const wallet = core.state.wallet;
    const ev = play(core, "drop");
    expect(find(ev, "errandEnded")).toEqual({ type: "errandEnded", to: "school" });
    expect(core.state.errand).toBeUndefined();
    expect(core.state.wallet).toBeGreaterThan(wallet);
    expect(availableSceneIds(c, core.state)).toContain("pickup");
    expect(availableSceneIds(c, core.state)).not.toContain("drop");
  });

  it("keeps the parcel overnight", () => {
    const { core } = pickedUp();
    core.send({ type: "sleep" });
    expect(core.state.day).toBe(2);
    expect(core.state.errand).toEqual({ to: "school" });
    walkToSchool(core);
    expect(types(core.send({ type: "startScene", scene: "drop" }))).toContain("sceneStarted");
  });

  it("with no slots left, the drop-off waits until the next day", () => {
    const { core } = pickedUp();
    walkToSchool(core);
    const tired = createCore(c, { ...core.state, slot: c.world.slotsPerDay }, { now: () => T0, rng: mulberry32(1) });
    expect(tired.send({ type: "startScene", scene: "drop" })).toEqual([{ type: "inputRejected", reason: "no-slots" }]);
    tired.send({ type: "goTo", place: "street" });
    tired.send({ type: "sleep" });
    tired.send({ type: "goTo", place: "school" });
    expect(types(tired.send({ type: "startScene", scene: "drop" }))).toContain("sceneStarted");
  });
});
```

- [ ] **Step 3: Write the failing save tests**

In `packages/core/test/save.test.ts`:
- Add `addErrand` to the fixture import.
- Append inside `describe("save", …)`:

```ts
  it("keeps an errand, drops one to a place the course no longer has, and rejects a malformed one", () => {
    const c = addErrand(fixtureCourse());
    const carrying = { ...newGame(c), errand: { to: "school" } };
    expect(parseSave(serialize(carrying), c)).toEqual({ ok: true, state: carrying });
    const gone = parseSave(serialize({ ...newGame(c), errand: { to: "moon" } }), c);
    expect(gone.ok && gone.state.errand).toBeUndefined();
    expect(parseSave(JSON.stringify({ ...newGame(c), errand: "school" }), c)).toEqual({ ok: false, reason: "bad-errand" });
  });

  it("loads a save from before errands with none", () => {
    const old = parseSave(serialize(newGame(course)), course);
    expect(old.ok && old.state.errand).toBeUndefined();
  });

  it("keeps a pickup's destination through a save mid-scene, and drops one that is no longer a place", () => {
    const c = addErrand(fixtureCourse());
    const core = createCore(c, { ...newGame(c), place: "noodle_shop", scenesDone: { intro: 1 } }, { now: () => 0, rng: () => 0 });
    core.send({ type: "startScene", scene: "pickup" });
    expect(core.state.run!.errandTo).toBe("school");
    const kept = parseSave(serialize(core.state), c);
    expect(kept.ok && kept.state.run?.errandTo).toBe("school");
    const moved = parseSave(serialize({ ...core.state, run: { ...core.state.run!, errandTo: "moon" } }), c);
    expect(moved.ok && moved.state.run?.errandTo).toBeUndefined();
  });
```

- [ ] **Step 4: Run them and watch them fail**

Run: `npx vitest run packages/core`
Expected: FAIL, with type errors or assertions about `errand`, `errandStarted` and `bad-errand`. The existing tests still pass.

- [ ] **Step 5: Types**

In `packages/core/src/types.ts`:
- `Scene` gains, after `trustGain`:
  ```ts
  /** "$<slot>": finishing this scene starts an errand to the place that slot named (its value is a place id). */
  startsErrand?: string;
  /** Finishing this scene delivers the errand. It is offered only while the errand is for this scene's place. */
  endsErrand?: boolean;
  ```
- `SceneRun` gains:
  ```ts
  /** the place a scene with startsErrand named, once its slot has been drawn */
  errandTo?: string;
  ```
- `GameState` gains, after `rentLate`:
  ```ts
  /** the parcel being carried, and where it goes; absent when there is none */
  errand?: { to: string };
  ```
- `GameEvent` gains two members, appended before `inputRejected`:
  ```ts
  | { type: "errandStarted"; to: string }
  | { type: "errandEnded"; to: string }
  ```

- [ ] **Step 6: Availability**

In `packages/core/src/life.ts` `isAvailable`, after the `repeatable` line:

```ts
  // One parcel at a time; a drop-off is there only while the parcel is for its place.
  if (scene.startsErrand && state.errand) return false;
  if (scene.endsErrand && state.errand?.to !== scene.place) return false;
```

- [ ] **Step 7: Start and end the errand**

In `packages/core/src/dialogue.ts` `beginExchange`, right after `const combo = chooseCombo(ctx, ex);`:

```ts
  const errandSlot = scene.startsErrand?.slice(1);
  if (errandSlot && errandSlot in combo) run.errandTo = combo[errandSlot];
```

In `finishScene`, after the `sceneEnded` push:

```ts
  if (scene.startsErrand && run.errandTo) {
    ctx.state.errand = { to: run.errandTo };
    ctx.ev.push({ type: "errandStarted", to: run.errandTo });
  }
  if (scene.endsErrand && ctx.state.errand) {
    const { to } = ctx.state.errand;
    delete ctx.state.errand;
    ctx.ev.push({ type: "errandEnded", to });
  }
```

- [ ] **Step 8: No "New:" line for drop-offs**

In `packages/core/src/core.ts`, replace the unlock loop body:

```ts
      for (const id of availableSceneIds(course, ctx.state)) {
        // A drop-off opens with every pickup; errandStarted says so, without naming the place.
        if (!before.has(id) && !course.scenes.find((s) => s.id === id)?.endsErrand) ctx.ev.push({ type: "unlocked", scene: id });
      }
```

- [ ] **Step 9: Save**

In `packages/core/src/save.ts`:
- In `isRunShape`, before the final `return`, add:
  ```ts
  if (x.errandTo !== undefined && typeof x.errandTo !== "string") return false;
  ```
- In `parseSave`, after the `bad-player` check, add:
  ```ts
  if (data.errand !== undefined && !(isObj(data.errand) && typeof data.errand.to === "string")) return { ok: false, reason: "bad-errand" };
  // A parcel for a place the course no longer has is dropped, so the pickup opens again.
  if (isObj(data.errand) && !course.world.places[data.errand.to as string]) delete data.errand;
  if (isObj(data.run) && typeof data.run.errandTo === "string" && !course.world.places[data.run.errandTo]) delete data.run.errandTo;
  ```

- [ ] **Step 10: Run the core tests**

Run: `npx vitest run packages/core && npm run typecheck`
Expected:
- All core tests pass.
- The typecheck may fail only in `packages/tui/src/app.ts`, if its event switch is exhaustive. If it does, add the two cases from Task 2 Step 3 now.

- [ ] **Step 11: Commit**

```bash
git add packages/core
git commit -m "core: errands — a pickup scene names a place, the drop-off there ends it (one parcel at a time, kept overnight, saved)"
```

---

### Task 2: The errand on screen

**Files:**
- Modify: `content/learner/en/ui.ftl` (`hud`, `errand-started`, `errand-ended`)
- Modify: `packages/tui/src/text.ts` (`UI_KEYS`)
- Modify: `packages/tui/src/app.ts` (events, HUD)
- Test: `packages/tui/test/app.test.ts`

**Interfaces:**
- Consumes:
  - `GameState.errand`;
  - the events `errandStarted` / `errandEnded`;
  - `addErrand` from `@silver-tongue/core/testing`.
- Produces: the UI keys `errand-started` and `errand-ended`, and the `hud` variable `parcel` ("yes" / "no").

- [ ] **Step 1: Write the failing tests**

In `packages/tui/test/app.test.ts`:
- Change the testing import to `import { addErrand, line } from "@silver-tongue/core/testing";`.
- Add inside `describe("tui app", …)`:

```ts
  const ERRAND_TEXT = `
scene-pickup = Take a parcel
scene-drop = Deliver the parcel
place-school = School
place-school-desc = A school.
npc-teacher = Teacher
asked-deliver = They wanted it taken to the { $place }.
`;
  /** Presses the number of the menu item whose label contains `label`. */
  const pressItem = (term: FakeTerminal, label: string) => {
    const row = term.screen().find((l) => l.includes(label));
    const n = row?.match(/(\d)\) /)?.[1];
    if (!n) throw new Error(`no menu item "${label}" in:\n${term.screen().join("\n")}`);
    term.press(n);
  };
  const answerAll = (core: ReturnType<typeof setup>["core"], term: FakeTerminal) => {
    for (let i = 0; core.state.run && i < 10; i++) {
      if (core.state.run.mode !== "pick") term.press("escape"); // not expected here: fresh words are picked
      term.press(rightKey(core));
    }
  };

  it("says when you take a parcel and when you hand it over, never where it goes", () => {
    const { core, term } = setup(
      (s) => { s.place = "noodle_shop"; s.scenesDone = { intro: 1 }; },
      (c) => { addErrand(c); c.learnerFtl += ERRAND_TEXT; },
    );
    pressItem(term, "Take a parcel");
    answerAll(core, term);
    const taken = term.screen().join("\n");
    expect(taken).toContain("You're carrying a parcel.");
    expect(taken).not.toContain("New: Deliver the parcel");
    expect(taken).not.toMatch(/School|school/);
    pressItem(term, "Go to The street");
    pressItem(term, "Go to School");
    pressItem(term, "Deliver the parcel");
    answerAll(core, term);
    expect(term.screen().join("\n")).toContain("You hand over the parcel.");
  });

  it("marks the status line while a parcel is carried", () => {
    expect(setup((s) => { s.errand = { to: "street" }; }).term.screen()[0]).toContain("parcel");
    expect(setup().term.screen()[0]).not.toContain("parcel");
  });

  it("keeps the status line inside a phone-width frame with a parcel and rent due", () => {
    const { term } = setup((s) => { s.errand = { to: "street" }; s.rentLate = true; });
    term.resize(40, 16);
    for (const l of term.frames.at(-1)!) expect(lineWidth(l)).toBe(40);
  });
```

Notes on these tests:
- If the HUD is not on `screen()[0]` in this fixture, find the row with `/Day \d/` instead, and record the ruling.
- `answerAll` presses `escape` only as a guard. If the mode is ever tiles, rule on how to answer in the ledger.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run packages/tui`
Expected: the three new tests FAIL (no text, no marker). The others pass.

- [ ] **Step 3: Implement**

`content/learner/en/ui.ftl`: replace the `hud` entry, and add the errand lines after `unlocked = New: { $scene }`:

```ftl
hud = Day { $day } · slot { $slot }/{ $slots } · { $currency }{ $wallet } · { $rank }{ $parcel ->
    [yes] { " · parcel" }
   *[no] {""}
}{ $rentLate ->
    [yes] { " · rent due" }
   *[no] {""}
}
```

```ftl
errand-started = You're carrying a parcel.
errand-ended = You hand over the parcel.
```

In `packages/tui/src/text.ts` `UI_KEYS`, change `hud` to `["day", "slot", "slots", "currency", "wallet", "rank", "parcel", "rentLate"]`, and add after `unlocked: ["scene"],`:

```ts
  "errand-started": [],
  "errand-ended": [],
```

In `packages/tui/src/app.ts`:
- In `render()`'s `t("hud", {…})`, add `parcel: s.errand ? "yes" : "no",`.
- In the event switch, after the `unlocked` case:
  ```ts
          case "errandStarted":
            push([{ text: t("errand-started"), color: "cyan" }]);
            break;
          case "errandEnded":
            push([{ text: t("errand-ended"), color: "cyan" }]);
            break;
  ```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/tui && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/learner/en/ui.ftl packages/tui
git commit -m "tui: 'You're carrying a parcel.' on pickup, 'You hand over the parcel.' on delivery, and a parcel marker in the status line"
```

---

### Task 3: Checker rules and bots

**Files:**
- Modify: `tools/src/check.ts`
- Modify: `tools/src/bots.ts`
- Test: `tools/test/check.test.ts`, `tools/test/bots.test.ts`

**Interfaces:**
- Consumes: `Scene.startsErrand` / `endsErrand`, the `errandEnded` event, `addErrand`.
- Produces: `BotReport.errands: number`.

- [ ] **Step 1: Write the failing checker tests**

In `tools/test/check.test.ts`:
- Import `addErrand` alongside `fixtureCourse`.
- Add inside `describe("checkCourse", …)`:

```ts
  describe("errands", () => {
    const ERRAND_IDS = ["scene-pickup", "scene-drop", "place-school", "place-school-desc", "npc-teacher", "asked-deliver"];
    const run = (change: (c: ReturnType<typeof fixtureCourse>) => void = () => {}) => {
      const c = addErrand(fixtureCourse());
      change(c);
      return checkCourse(input({ course: c, learnerIds: new Set([...LEARNER, ...ERRAND_IDS]) }));
    };

    it("passes a pickup with one drop-off at each place it can name", () => {
      expect(run()).toEqual([]);
    });

    it("rejects an errand slot that names something other than a place", () => {
      expect(run((c) => (c.scenes[2].startsErrand = "$nope"))).toContain('pickup: startsErrand "$nope" is not a slot of any exchange');
      expect(
        run((c) => {
          c.groups.dests = ["school", "tea"];
          // variants for the new value, so only the errand rule complains
          const ex = c.scenes[2].exchanges[0];
          ex.variants["to=tea"] = structuredClone(ex.variants["to=school"]);
        }),
      ).toContain('pickup: errand goes to "tea", which is not a place');
    });

    it("needs exactly one drop-off at each destination, and no drop-off nobody sends parcels to", () => {
      expect(run((c) => c.scenes.pop())).toContain('pickup: errand goes to "school", which has no scene that ends an errand');
      expect(run((c) => c.scenes.push({ ...structuredClone(c.scenes[3]), id: "drop2" }))).toContain(
        'pickup: errand goes to "school", which has 2 scenes that end an errand; needs 1',
      );
      expect(run((c) => delete c.scenes[2].startsErrand)).toContain('drop: ends an errand, but no errand goes to "school"');
    });
  });
```

Notes:
- `"to=school"` must be the fixture's actual `comboKey({ to: "school" })`. Import `comboKey` from `@silver-tongue/core` and use it if the format differs.
- The `drop2` case also adds a scene name, so add `"scene-drop2"` to `ERRAND_IDS` if the checker reports it missing.
- The expectations use `toContain`, so the other errors don't matter.

- [ ] **Step 2: Write the failing bot test**

In `tools/test/bots.test.ts`:
- Import `addErrand` alongside `fixtureCourse`.
- Add a test in the fixture `describe` block, or in a new `describe("bots (fixture)")` if none exists:

```ts
  it("walks a parcel to where it goes, and counts it", () => {
    const c = addErrand(fixtureCourse());
    const r = runBot(c, BOTS.right, { days: 3, seed: 1 });
    expect(r.errands).toBeGreaterThan(0);
    expect(r.rejected).toBe(0);
  });
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run tools/test/check.test.ts tools/test/bots.test.ts`
Expected: FAIL. There are no errand errors yet, and `errands` is undefined.

- [ ] **Step 4: Implement the checker rules**

In `tools/src/check.ts`, after the per-scene loop (the one ending with the hinge checks) and before `const allowed = …`:

```ts
  // Errands: a pickup's slot names the place the parcel goes; each such place has exactly one
  // drop-off, and every drop-off is somewhere a pickup can send you.
  const dropsAt = new Map<string, string[]>();
  for (const s of course.scenes) if (s.endsErrand) dropsAt.set(s.place, [...(dropsAt.get(s.place) ?? []), s.id]);
  const destinations = new Set<string>();
  for (const s of course.scenes) {
    if (s.startsErrand === undefined) continue;
    const slot = s.startsErrand.startsWith("$") ? s.startsErrand.slice(1) : "";
    const ex = s.exchanges.find((e) => slot && slot in e.slots);
    if (!ex) {
      errors.push(`${s.id}: startsErrand "${s.startsErrand}" is not a slot of any exchange`);
      continue;
    }
    for (const to of course.groups[ex.slots[slot]] ?? []) {
      destinations.add(to);
      const n = dropsAt.get(to)?.length ?? 0;
      if (!world.places[to]) errors.push(`${s.id}: errand goes to "${to}", which is not a place`);
      else if (n === 0) errors.push(`${s.id}: errand goes to "${to}", which has no scene that ends an errand`);
      else if (n > 1) errors.push(`${s.id}: errand goes to "${to}", which has ${n} scenes that end an errand; needs 1`);
    }
  }
  for (const [place, ids] of dropsAt) {
    if (!destinations.has(place)) for (const id of ids) errors.push(`${id}: ends an errand, but no errand goes to "${place}"`);
  }
```

- [ ] **Step 5: Implement the bots**

In `tools/src/bots.ts`:
- `BotReport` gains `/** parcels delivered */ errands: number;`, and the initial report gains `errands: 0`.
- In `goals`, replace the rank line:
  ```ts
      // A parcel in hand comes first; a pickup is paid work, since the trip pays at the other end.
      const rank = scene.endsErrand ? 1 : !scene.repeatable ? 0 : scene.startsErrand || scene.exchanges.some((ex) => ex.pay > 0) ? 2 : 3;
  ```
- The `paying` helper becomes:
  ```ts
  const paying = (id: string) => {
    const s = course.scenes.find((x) => x.id === id)!;
    return s.repeatable && (s.startsErrand !== undefined || s.exchanges.some((ex) => ex.pay > 0));
  };
  ```
- In the event loop, add `if (e.type === "errandEnded") report.errands += 1;`.
- In `main()`, add ` · errands ${r.errands}` to the printed summary line, right after the rejected count.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tools && npm run typecheck`
Expected: PASS. The real-content tests are unchanged, since there are no errands in content yet.

- [ ] **Step 7: Commit**

```bash
git add tools
git commit -m "tools: the checker holds errands to real places with one drop-off each; bots take pickups and walk parcels, and count deliveries"
```

---

### Task 4: Station Road content

**Files:**
- Modify: `content/settings/china-city/world.json`, `content/settings/china-city/groups.json`
- Create: `content/settings/china-city/scenes/delivery-{intro,pickup,hospital,school,station}.json`
- Modify: `content/languages/zh/extra-words.json`, `content/languages/zh/terms.ftl`, `content/languages/zh/notes.json`
- Create: `content/languages/zh/lines/delivery-*.ftl` (5)
- Modify: `content/learner/en/terms.ftl`, `glosses-zh-extra.ftl`, `narration-china-city.ftl`, `mentor-zh.ftl`
- Create: `content/learner/en/lines-zh/delivery-*.ftl` (5)
- Test: `tools/test/build-course.test.ts`, `tools/test/bots.test.ts`

**Interfaces:**
- Consumes: the scene fields from Task 1, and the checker and bots from Task 3.
- Produces: the real course with 15 scenes and 10 notes.

- [ ] **Step 1: Write the failing content tests**

In `tools/test/build-course.test.ts`:
- **Pinned lists:** add `delivery-intro`, `delivery-pickup`, `delivery-hospital`, `delivery-school` and `delivery-station` to the pinned scene list, and `nali`, `de` and `dian` (in that order, after `kuai`) to the pinned notes list.
- **The distinct-names test:** only scenes that get a "New:" line need distinct names, so filter:
  ```ts
    const names = course!.scenes.filter((sc) => !sc.endsErrand).map((sc) => course!.learnerFtl.match(new RegExp(`^scene-${sc.id} = (.*)$`, "m"))![1]);
  ```
- **The Market Street map test:** replace the market line with
  ```ts
    expect([...places.market.links].sort()).toEqual(["room", "station_road", "street", "warehouse"]);
    expect(places.market.links.length + course!.scenes.filter((s) => s.place === "market").length).toBe(6);
  ```
- **New test:**

```ts
  it("Miss Gao sends parcels to the three places on Station Road, each with one drop-off", () => {
    const pickup = course!.scenes.find((s) => s.id === "delivery-pickup")!;
    expect(pickup.startsErrand).toBe("$place");
    expect(course!.groups.destinations).toEqual(["hospital", "school", "station"]);
    for (const p of course!.groups.destinations) {
      expect(course!.world.places.station_road.links).toContain(p);
      expect(course!.scenes.filter((s) => s.endsErrand && s.place === p).map((s) => s.id)).toEqual([`delivery-${p}`]);
    }
    expect(course!.scenes.find((s) => s.id === "delivery-intro")!.after).toEqual(["warehouse-shift", "room-hello"]);
  });
```

In `tools/test/bots.test.ts` ("course bots (real content)"), add:

```ts
  it("the always-right player delivers parcels", () => {
    expect(reports.right.errands).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tools/test/build-course.test.ts tools/test/bots.test.ts`
Expected: the new and changed tests FAIL (no delivery scenes, and 0 errands).

- [ ] **Step 3: World and groups**

`world.json`:
- `places.market.links` becomes `["street", "room", "warehouse", "station_road"]`.
- Add the places:
  ```json
  "station_road": { "links": ["market", "school", "hospital", "station"] },
  "school": { "links": ["station_road"] },
  "hospital": { "links": ["station_road"] },
  "station": { "links": ["station_road"] }
  ```
- Add the npcs:
  ```json
  "dispatcher": { "place": "market" },
  "doctor": { "place": "hospital" },
  "teacher": { "place": "school" },
  "traveller": { "place": "station" }
  ```

`groups.json`: add `"destinations": ["hospital", "school", "station"]` to `groups`.

- [ ] **Step 4: Words and terms**

`content/languages/zh/extra-words.json`, append:
```json
  { "id": "x0007", "w": "高小姐", "lv": "1", "pron": "Gāo xiǎojiě" }
```

`content/learner/en/glosses-zh-extra.ftl`, append:
```ftl
x0007 = Miss Gao, who runs the delivery stall (the surname Gao + 小姐 "Miss")
```

`content/languages/zh/terms.ftl`, append:
```ftl
-hospital = 医院
-school = 学校
-station = 火车站
```

`content/learner/en/terms.ftl`, append:
```ftl
-hospital = { $form ->
    [cap] Hospital
   *[base] hospital
}
-school = { $form ->
    [cap] School
   *[base] school
}
-station = { $form ->
    [cap] Train station
   *[base] train station
}
```

- [ ] **Step 5: Scene skeletons**

`scenes/delivery-intro.json`:
```json
{
  "id": "delivery-intro",
  "place": "market",
  "npc": "dispatcher",
  "stage": 1,
  "after": ["warehouse-shift", "room-hello"],
  "requires": {},
  "repeatable": false,
  "trustGain": 1,
  "exchanges": [
    { "id": "greet", "slots": {}, "expect": { "action": "dispatcher" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "hospital", "slots": {}, "expect": { "action": "places" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "school", "slots": {}, "expect": { "action": "places" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "station", "slots": {}, "expect": { "action": "places" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "where", "slots": {}, "expect": { "action": "where" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "job", "slots": {}, "expect": { "action": "job" }, "hinges": [], "pay": 0, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

`scenes/delivery-pickup.json`:
```json
{
  "id": "delivery-pickup",
  "place": "market",
  "npc": "dispatcher",
  "stage": 1,
  "after": ["delivery-intro"],
  "requires": { "trust": { "dispatcher": 1 } },
  "repeatable": true,
  "trustGain": 1,
  "startsErrand": "$place",
  "exchanges": [
    {
      "id": "parcel",
      "slots": { "place": "destinations" },
      "expect": { "action": "deliver", "place": "$place" },
      "hinges": ["$place"],
      "pay": 0,
      "missCost": 1
    },
    { "id": "now", "slots": {}, "expect": { "action": "now" }, "hinges": [], "pay": 0, "missCost": 0 }
  ]
}
```

`scenes/delivery-hospital.json`:
```json
{
  "id": "delivery-hospital",
  "place": "hospital",
  "npc": "doctor",
  "stage": 1,
  "after": ["delivery-pickup"],
  "requires": {},
  "repeatable": true,
  "trustGain": 1,
  "endsErrand": true,
  "exchanges": [
    { "id": "who", "slots": {}, "expect": { "action": "who" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "doctor", "slots": {}, "expect": { "action": "doctor" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 4, "missCost": 0 }
  ]
}
```

`scenes/delivery-school.json`:
```json
{
  "id": "delivery-school",
  "place": "school",
  "npc": "teacher",
  "stage": 1,
  "after": ["delivery-pickup"],
  "requires": {},
  "repeatable": true,
  "trustGain": 1,
  "endsErrand": true,
  "exchanges": [
    { "id": "who", "slots": {}, "expect": { "action": "who" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "teacher", "slots": {}, "expect": { "action": "teacher" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "books", "slots": {}, "expect": { "action": "books" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 2, "missCost": 0 }
  ]
}
```

`scenes/delivery-station.json`:
```json
{
  "id": "delivery-station",
  "place": "station",
  "npc": "traveller",
  "stage": 1,
  "after": ["delivery-pickup"],
  "requires": {},
  "repeatable": true,
  "trustGain": 1,
  "endsErrand": true,
  "exchanges": [
    { "id": "who", "slots": {}, "expect": { "action": "who" }, "hinges": [], "pay": 2, "missCost": 0 },
    { "id": "beijing", "slots": {}, "expect": { "action": "beijing" }, "hinges": [], "pay": 2, "missCost": 0 },
    {
      "id": "time",
      "slots": { "hour": "numbers_3_10" },
      "expect": { "action": "time", "hour": "$hour" },
      "hinges": ["$hour"],
      "pay": 2,
      "missCost": 1
    },
    { "id": "bye", "slots": {}, "expect": { "action": "bye" }, "hinges": [], "pay": 2, "missCost": 0 }
  ]
}
```

- [ ] **Step 6: Chinese lines** (`content/languages/zh/lines/`)

`delivery-intro.ftl`:
```ftl
# Miss Gao shows you where things are on Station Road. Wrong replies use only words met by then.

greet = 你好！我是高小姐。你是{ $player }吗？
greet-reply = 是，我是{ $player }。
greet-alt1 = 我饿了。
greet-alt2 = 八，九，十！

hospital = 医院在那里。
hospital-reply = 医院在那里。
hospital-alt1 = 那个大桌子。
hospital-alt2 = 你好吗？

school = 学校在医院前面。
school-reply = 在医院前面。
school-alt1 = 我想工作。
school-alt2 = 医院在那里。

station = 火车站在医院后面。
station-reply = 在医院后面。
station-alt1 = 在医院前面。
station-alt2 = 谢谢！再见！

where = 学校在哪里？
where-reply = 在医院前面！
where-alt1 = 在医院后面！
where-alt2 = 医院在那里。

job = 很好！你想工作吗？明天来！
job-reply = 想！我明天来。
job-alt1 = 我喜欢面条。
job-alt2 = 在医院后面。

bye = 再见，{ $player }！
bye-reply = 再见，高小姐！
bye-alt1 = 你好，高小姐！
bye-alt2 = 学校在哪里？
```

`delivery-pickup.ftl`:
```ftl
# Miss Gao hands you a parcel and says where it goes. The place is what you walk to.

parcel = 这个东西，去{ -place }。
parcel-reply = 好，我去{ -place }。
parcel-rephrase = { -place }！这个东西。

now = 你现在去吗？
now-reply = 我现在去！
now-alt1 = 我明天来。
now-alt2 = 在医院后面！
```

`delivery-hospital.ftl`:
```ftl
who = 你好！你是谁？
who-reply = 我是高小姐的朋友。
who-alt1 = 我叫老王。
who-alt2 = 学校在哪里？

doctor = 谢谢！我是医生。
doctor-reply = 你好，医生！
doctor-alt1 = 再见，高小姐！
doctor-alt2 = 我饿了。

bye = 这是八块钱。再见！
bye-reply = 谢谢，医生！再见！
bye-alt1 = 你是谁？
bye-alt2 = 我现在去！
```

`delivery-school.ftl`:
```ftl
who = 你好！你是谁？
who-reply = 我是高小姐的朋友。
who-alt1 = 我叫老王。
who-alt2 = 医院在那里。

teacher = 好！我是老师。
teacher-reply = 你好，老师！
teacher-alt1 = 再见，高小姐！
teacher-alt2 = 我想工作。

books = 这是书吗？
books-reply = 是，是书。
books-alt1 = 我现在去！
books-alt2 = 你好，老师！

bye = 谢谢！学生喜欢书。
bye-reply = 不客气！再见！
bye-alt1 = 你是谁？
bye-alt2 = 我饿了。
```

`delivery-station.ftl`:
```ftl
who = 你好！你是谁？
who-reply = 我是高小姐的朋友。
who-alt1 = 我叫老王。
who-alt2 = 在医院后面。

beijing = 谢谢！我去北京。
beijing-reply = 北京！很好！
beijing-alt1 = 我明天来。
beijing-alt2 = 你好，大刘！

time = 现在{ -hour }点了！
time-reply = { -hour }点了！再见！
time-rephrase = { -hour }点！现在{ -hour }点了！

bye = 再见！
bye-reply = 再见！
bye-alt1 = 你是谁？
bye-alt2 = 我饿了。
```

- [ ] **Step 7: English meanings** (`content/learner/en/lines-zh/`)

`delivery-intro.ftl`:
```ftl
greet = Hello! I'm Miss Gao. Are you { $player }?
greet-reply = Yes, I'm { $player }.
greet-alt1 = I'm hungry.
greet-alt2 = Eight, nine, ten!

hospital = The hospital is over there.
hospital-reply = The hospital is over there.
hospital-alt1 = That big table.
hospital-alt2 = How are you?

school = The school is in front of the hospital.
school-reply = In front of the hospital.
school-alt1 = I want to work.
school-alt2 = The hospital is over there.

station = The train station is behind the hospital.
station-reply = Behind the hospital.
station-alt1 = In front of the hospital.
station-alt2 = Thank you! Goodbye!

where = Where is the school?
where-reply = In front of the hospital!
where-alt1 = Behind the hospital!
where-alt2 = The hospital is over there.

job = Very good! Do you want to work? Come tomorrow!
job-reply = I do! I'll come tomorrow.
job-alt1 = I like noodles.
job-alt2 = Behind the hospital.

bye = Goodbye, { $player }!
bye-reply = Goodbye, Miss Gao!
bye-alt1 = Hello, Miss Gao!
bye-alt2 = Where is the school?
```

`delivery-pickup.ftl`:
```ftl
parcel = This thing goes to the { -place }.
parcel-reply = OK, I'll go to the { -place }.
parcel-rephrase = The { -place }! This thing.

now = Are you going now?
now-reply = I'm going now!
now-alt1 = I'll come tomorrow.
now-alt2 = Behind the hospital!
```

`delivery-hospital.ftl`:
```ftl
who = Hello! Who are you?
who-reply = I'm Miss Gao's friend.
who-alt1 = My name is Old Wang.
who-alt2 = Where is the school?

doctor = Thank you! I'm a doctor.
doctor-reply = Hello, doctor!
doctor-alt1 = Goodbye, Miss Gao!
doctor-alt2 = I'm hungry.

bye = Here's eight kuai. Goodbye!
bye-reply = Thank you, doctor! Goodbye!
bye-alt1 = Who are you?
bye-alt2 = I'm going now!
```

`delivery-school.ftl`:
```ftl
who = Hello! Who are you?
who-reply = I'm Miss Gao's friend.
who-alt1 = My name is Old Wang.
who-alt2 = The hospital is over there.

teacher = Good! I'm a teacher.
teacher-reply = Hello, teacher!
teacher-alt1 = Goodbye, Miss Gao!
teacher-alt2 = I want to work.

books = Are these books?
books-reply = Yes, they're books.
books-alt1 = I'm going now!
books-alt2 = Hello, teacher!

bye = Thank you! The students like books.
bye-reply = You're welcome! Goodbye!
bye-alt1 = Who are you?
bye-alt2 = I'm hungry.
```

`delivery-station.ftl`:
```ftl
who = Hello! Who are you?
who-reply = I'm Miss Gao's friend.
who-alt1 = My name is Old Wang.
who-alt2 = Behind the hospital.

beijing = Thank you! I'm going to Beijing.
beijing-reply = Beijing! Very good!
beijing-alt1 = I'll come tomorrow.
beijing-alt2 = Hello, Big Liu!

time = It's { -hour } o'clock already!
time-reply = { -hour(form: "cap") } o'clock already! Goodbye!
time-rephrase = { -hour(form: "cap") } o'clock! It's { -hour } o'clock already!

bye = Goodbye!
bye-reply = Goodbye!
bye-alt1 = Who are you?
bye-alt2 = I'm hungry.
```

- [ ] **Step 8: Narration** (`content/learner/en/narration-china-city.ftl`)

Insert before `place-warehouse = Warehouse`:
```ftl
place-station_road = Station Road
place-station_road-desc = A wide road down to the train station. The school is in front of the hospital, and the station is behind it.
place-school = School
place-school-desc = Children's voices through the open windows, and a teacher at the gate.
place-hospital = Hospital
place-hospital-desc = White walls and a long queue. A doctor hurries past.
place-station = Train Station
place-station-desc = Announcements you can't follow, and people with too much luggage.
```

Change `place-market-desc` to:
```ftl
place-market-desc = Stalls, scooters and a warehouse with its doors wide open. A young woman sits behind a stall piled with parcels. Your room is up the stairs above a shuttered shop, and at the far end the road runs down to the station.
```

After `npc-foreman = Big Liu`:
```ftl
npc-dispatcher = Miss Gao
npc-doctor = Doctor
npc-teacher = Teacher
npc-traveller = Traveller
```

Before the `# What a reply does` comment:
```ftl
scene-delivery-intro = Meet Miss Gao
scene-delivery-intro-start = A young woman at a stall piled with parcels waves you over. She points down the road, and starts naming things.
scene-delivery-intro-end = Miss Gao writes your name on a parcel label. Deliveries, from tomorrow.
scene-delivery-pickup = Take a delivery
scene-delivery-pickup-start = Miss Gao lifts a parcel onto the counter and taps the label.
scene-delivery-pickup-end = You tuck the parcel under your arm. Now, where was it going?
scene-delivery-hospital = Deliver the parcel
scene-delivery-hospital-start = A doctor in a white coat looks at the parcel under your arm.
scene-delivery-hospital-end = The doctor signs for the parcel and pays you.
scene-delivery-school = Deliver the parcel
scene-delivery-school-start = The teacher at the gate looks at the parcel under your arm.
scene-delivery-school-end = The teacher carries the parcel inside, and pays you.
scene-delivery-station = Deliver the parcel
scene-delivery-station-start = A traveller sitting on a suitcase jumps up when she sees the parcel.
scene-delivery-station-end = She takes the parcel, pays you, and runs for her train.
```

Append at the end:
```ftl
asked-dispatcher = They were telling you their name, and checking yours.
asked-places = They were showing you where things are.
asked-where = They wanted to know where the school is.
action-deliver = You'll take it to the { $place }.
asked-deliver = They wanted it taken to the { $place }.
asked-now = They wanted to know if you're going now.
asked-who = They wanted to know who you are.
asked-doctor = They were telling you they're a doctor.
asked-teacher = They were telling you they're a teacher.
asked-books = They wanted to know if it's books.
asked-beijing = They were telling you where they're going.
asked-time = They were telling you the time: { $hour } o'clock.
```

- [ ] **Step 9: Mentor notes**

`content/languages/zh/notes.json`, append after `kuai`:
```json
  { "id": "nali", "trigger": { "scene": "delivery-intro" } },
  { "id": "de", "trigger": { "word": "w0125" } },
  { "id": "dian", "trigger": { "word": "w0115" } }
```

`content/learner/en/mentor-zh.ftl`, append:
```ftl

note-nali-title = 哪里, 那里, 这里
note-nali = 哪里 (nǎlǐ) is "where", 那里 (nàlǐ) "there" and 这里 (zhèlǐ) "here": 学校在哪里？ In the north people say 哪儿, 那儿 and 这儿 (nǎr, nàr, zhèr). They mean the same.

note-de-title = 的, whose
note-de = 的 (de) joins an owner to a thing: 高小姐的朋友 is "Miss Gao's friend", and 医院的东西 is "the hospital's things".

note-dian-title = 点, o'clock
note-dian = 点 (diǎn) after a number gives the hour: 三点 is three o'clock, and 现在几点？ asks "what time is it?". The 了 in 三点了 means "it's three already".
```

- [ ] **Step 10: Build and run the tests**

Run: `npm run build:course && npx vitest run && npm run typecheck && npm run bots`
Expected:
- The build says `built zh-china-en: 15 scenes`, with no errors.
- All tests pass.
- The bots show `rejected 0`, `dead-end days 0`, `broke without work 0` and `notes 10/10` for every bot, with `errands` above 0 for `right`.

If a bot fails to finish a one-off scene, or `brokeWithoutWork` is above 0, don't loosen the test. Record the cause in the ledger and rule on the smallest content fix, e.g. a scene's `after`.

- [ ] **Step 11: Commit**

```bash
git add content tools/test
git commit -m "content: Station Road and Miss Gao's deliveries (school, hospital, train station); notes on 哪里, 的 and 点"
```

---

### Task 5: Verify, play, review, release

- [ ] **Step 1: Full verification**

Run: `npx vitest run > $WS/final.log 2>&1; tail -5 $WS/final.log; npm run typecheck && npm run build:course && npm run bots && npm run build:web`
Expected: everything passes.

- [ ] **Step 2: Play through the real course**
  - **Scripted:** use a temporary `tools/src/zz-play.ts` (delete it afterwards) that drives `startApp` with `FakeTerminal`.
    - Check that Market Street's menu has 6 items.
    - Check that the pickup prints "You're carrying a parcel." and no "New:" line.
    - Check that the status line shows "parcel".
    - Answer the parcel exchange wrong once, and see "They wanted it taken to the …".
    - Walk to the right place and deliver.
  - **Terminal:** in a pty, run `npm run play` and do the same path.
  - **Browser:** run `build:web` and playwright at 390×760, and check Market Street and Station Road's menus and the status line.
  - Fix anything broken test-first, and ledger each fix as a ruling.

- [ ] **Step 3: Review**

Build the review package, then dispatch one opus reviewer with the spec, this plan, the Review Focus and the ledger rulings. Fix every finding, minors included (the user's standing preference), each test-first.

- [ ] **Step 4: Release 0.9.0**

- Set `packages/tui-node/package.json` to `"version": "0.9.0"`.
- Run `npm install --package-lock-only`.
- Commit `release: 0.9.0`.
- Then:
  ```bash
  git checkout main && git merge --no-ff b3-2b-deliveries -m "Merge branch 'b3-2b-deliveries': Miss Gao's deliveries on Station Road (0.9.0)" && git push origin main
  ```
- Watch the `ci`, `publish` and `pages` runs until they succeed, and confirm `npm view silver-tongue version` prints `0.9.0`.

- [ ] **Step 5: After the release**

- **Progress artifact:** read https://claude.ai/artifact/MXUS9cc9XHZaMDCi2S13Ws, then update it:
  - latest version 0.9.0 and the date;
  - 2b Done, 2c Next;
  - a 0.9.0 Releases row with the new words (高小姐 · 医院 学校 火车站 · 在 哪 那里 前面 后面 · 明天 来 去 东西 现在 · 谁 的 医生 老师 书 学生 北京 点).
  Then republish it.
- **Memory:** update the status memory.
- **Cleanup:** delete the plan's `.superpowers/sdd` workspace.
- **Report:** tell the user briefly.
