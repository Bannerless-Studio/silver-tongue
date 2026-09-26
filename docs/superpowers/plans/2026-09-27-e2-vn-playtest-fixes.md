# E2: Playing the Visual Novel Comfortably Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The visual novel plays itself on a timer that gives each line time to be read and heard, speaks slowly by default at a speed the player chooses, tells the place menu apart from the reply options, and opens on an intro that says 1980.

**Architecture:**
- The speech speed is a player preference in `view`, beside `course` and `learner`, stored in `silver-tongue:settings` and read by both web pages. The rates live beside `Speech`; each audio player asks for the rate per clip, so changing it takes effect at once.
- The auto-advance timer lives in the visual novel's DOM-free controller (`vn.ts`), which already owns the beat queue. Time is injected (`wait`), the same way `createWebAudio` takes its timer, so the whole rule is testable with a fake clock.
- `AudioOut` grows an optional `busy`, so a beat with a clip is never left before the clip has finished. The controller asks; it never guesses a clip's length.
- The place menu and the reply options become two components with two looks, because the NPCs stand left of centre and the two are never on screen together.
- The intro is content: four Fluent lines in the china-city narration.

**Tech Stack:** TypeScript, Vitest, Preact 10 (JSX via `jsxImportSource: "preact"`), Fluent (`@fluent/bundle`), `localStorage`.

**Spec:** `docs/superpowers/specs/2026-09-27-e2-vn-playtest-fixes-design.md`

## Global Constraints

- Always keep core free of I/O and rendering; front ends talk to it only through `send` and `state` (CLAUDE.md). Nothing in this plan touches `packages/core`.
- Time is always injected: no `setTimeout` inside a module that has a caller who can pass a clock. `WebAudioDeps.wait` is the pattern to copy.
- `localStorage` key names do not change. `silver-tongue:settings` gains two fields; nothing is renamed and no save format changes.
- Every string the visual novel shows comes from the learner `ui.ftl` and is listed in `VN_UI_KEYS`, which `packages/view/test/text.test.ts` already checks. No new hard-coded English in `packages/vn-web`. Note there is an older `vn-slow = Say it slowly`; the new ids are `vn-speed-*` and must not collide.
- Run `npm run build:course` after any change under `content/`, and never commit a course with checker errors. The intro lines are narration and have no clips, so `npm run audio` is not needed.
- The terminal game's screens, keys and texts do not change. Its player gains a `busy` getter and nothing else.
- Commit style matches the repo: lowercase prefix, one short line, then a paragraph saying what changed and why, then the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Every commit below uses `git commit -m "<subject>" -m "<body>" -m "Co-Authored-By: …"`; write the body in plain words, as the last few commits do.
- Release: version **0.15.0**. The `CHANGELOG.md` entry comes before the `release:` commit. Do not push, publish to npm or close the GitHub issues without the owner's OK.

## Review Focus

1. **The timer racing a press.** A press must take the line immediately and the timer it cancelled must do nothing afterwards, or lines skip. Pinned in Task 7 ("a press takes the line straight away").
2. **A clip cut off mid-word.** At the slower default a clip runs about 40% longer, so the dwell usually expires first. When it does not, the beat must wait for `busy` to go false. Pinned in Task 7 ("stays until the clip has finished") and Task 2 ("is busy from play() until the last clip ends").
3. **A setting that forgets itself.** Both pages rewrite the settings object when they remember a course; a plain write would wipe the speed on the next visit. Pinned in Task 4 ("changes one setting without losing the others").
4. **Auto-advance while the player is reading something else.** An open notebook, a word card, a background tab, the name box and the day card must all hold the line. Pinned in Task 7 ("waits while an overlay is open") and Task 8.
5. **The two buttons looking like one thing again.** The place menu must not look like a reply card, and neither may lose its number key. No unit test: checked by hand in Task 9.

---

## File Structure

```
packages/view/src/audio.ts            MODIFIED  SPEEDS, SpeechSpeed, playbackRate, nextSpeed, AudioOut.busy
packages/view/src/choose.ts           MODIFIED  PlayerSettings.speed / autoAdvance, parseSettings
packages/view/src/index.ts            MODIFIED  export the values, not just the types
packages/view/test/audio.test.ts      NEW       playbackRate and nextSpeed
packages/view/test/choose.test.ts     MODIFIED  the two new fields
packages/web-common/src/web-audio.ts  MODIFIED  rate() per clip, busy getter
packages/web-common/src/web-storage.ts MODIFIED updateWebSettings (merge, not replace)
packages/web-common/test/web-audio.test.ts    MODIFIED  rates, busy; one existing slow-rate expectation changes
packages/web-common/test/web-storage.test.ts  MODIFIED  updateWebSettings
packages/tui-node/src/node-audio.ts   MODIFIED  busy getter
packages/tui-node/test/node-audio.test.ts      MODIFIED  busy
packages/tui-web/src/main.ts          MODIFIED  speed from settings, rate(), updateWebSettings
packages/vn-web/src/dwell.ts          NEW       dwellMs(beat): how long a beat stays up
packages/vn-web/src/vn.ts             MODIFIED  wait, hold, setAuto, the timer
packages/vn-web/test/dwell.test.ts    NEW
packages/vn-web/test/vn.test.ts       MODIFIED  six auto-advance tests
packages/vn-web/src/main.tsx          MODIFIED  prefs, setPref, pass autoAdvance, merge settings
packages/vn-web/src/ui/App.tsx        MODIFIED  Page.prefs/setPref, hold wiring, Replies + PlaceMenu
packages/vn-web/src/ui/Overlays.tsx   MODIFIED  the two settings rows
packages/vn-web/src/ui/Replies.tsx    NEW       what you can say
packages/vn-web/src/ui/PlaceMenu.tsx  NEW       where you can go
packages/vn-web/src/ui/Choices.tsx    DELETED   split into the two above
packages/vn-web/src/vn.css            MODIFIED  .replies/.reply-card, .place-menu/.place-item
packages/view/src/text.ts             MODIFIED  VN_UI_KEYS
content/learner/en/ui.ftl             MODIFIED  vn-speed*, vn-advance*
content/learner/en/narration-china-city.ftl  MODIFIED  intro-1..4
CHANGELOG.md, packages/tui-node/package.json, package-lock.json   MODIFIED  release 0.15.0
```

---

### Task 1: A speech speed in `view`, and settings that carry it

**Files:**
- Modify: `packages/view/src/audio.ts`, `packages/view/src/choose.ts`, `packages/view/src/index.ts`
- Create: `packages/view/test/audio.test.ts`
- Modify: `packages/view/test/choose.test.ts`

**Interfaces:**
- Produces: `SPEEDS: readonly ["slow", "normal", "fast"]`, `SpeechSpeed`, `SPEED_RATES`, `SLOW_RATE_FACTOR`, `SLOWEST_RATE`, `playbackRate(speed, slow?): number`, `nextSpeed(speed): SpeechSpeed`, and `AudioOut.busy?: boolean`.
- Produces: `PlayerSettings.speed?: SpeechSpeed` and `PlayerSettings.autoAdvance?: boolean`.
- `packages/view/src/index.ts` changes `export type { AudioOut, Speech } from "./audio"` to `export * from "./audio"`, so `@silver-tongue/tui` (which re-exports view with `export *`) and both web pages get the values too.

- [ ] **Step 1: Write the failing tests**

`packages/view/test/audio.test.ts` (new file):
```ts
import { describe, expect, it } from "vitest";
import { nextSpeed, playbackRate, SPEEDS } from "../src/audio";

describe("playbackRate", () => {
  it("plays at the speed the player chose", () => {
    expect(SPEEDS.map((s) => playbackRate(s))).toEqual([0.7, 0.85, 1]);
  });

  it("plays a slow line at 0.75 of the chosen speed", () => {
    expect(playbackRate("slow", true)).toBeCloseTo(0.525);
    expect(playbackRate("normal", true)).toBeCloseTo(0.6375);
    expect(playbackRate("fast", true)).toBe(0.75);
  });
});

describe("nextSpeed", () => {
  it("cycles slow, normal, fast and back to slow", () => {
    expect(SPEEDS.map((s) => nextSpeed(s))).toEqual(["normal", "fast", "slow"]);
  });
});
```

In `packages/view/test/choose.test.ts`, inside the existing `describe` for `parseSettings` (or at the end of the file's last `describe`), add:
```ts
  it("reads the speech speed and whether the visual novel plays itself, and leaves anything else unset", () => {
    expect(parseSettings('{"speed":"normal","autoAdvance":false}')).toEqual({ speed: "normal", autoAdvance: false });
    expect(parseSettings('{"speed":"quick"}')).toEqual({});
    expect(parseSettings('{"autoAdvance":"no"}')).toEqual({});
  });
```
Check the file's first line imports `parseSettings`; if it does not, add it to the existing import from `../src/choose`.

- [ ] **Step 2: Run the tests to see them fail**

```bash
npx vitest run packages/view/test/audio.test.ts packages/view/test/choose.test.ts
```
Expected: FAIL — `packages/view/test/audio.test.ts` cannot resolve `../src/audio`'s exports (`nextSpeed`/`playbackRate`/`SPEEDS` do not exist) and the `parseSettings` case fails on the two new fields.

- [ ] **Step 3: Add the speed table to `packages/view/src/audio.ts`**

Replace the whole file with:
```ts
/** What one line says: its clips in order, and whether to say them slowly. */
export interface Speech {
  clips: string[];
  slow?: boolean;
}

/** Sound out, as each front end provides it. The app decides what to say; this only says it. */
export interface AudioOut {
  /** Whether sound can play at all here (a player program was found, the browser allows it). */
  readonly available: boolean;
  /** A clip is playing or queued behind one. A front end that does not say leaves it unset. */
  readonly busy?: boolean;
  /** Stops anything playing, then says these lines in order, with a short beat between clips. */
  play(lines: Speech[]): void;
  stop(): void;
}

/** How fast clips play, slowest first: a beginner wants time to copy what they hear. */
export const SPEEDS = ["slow", "normal", "fast"] as const;
export type SpeechSpeed = (typeof SPEEDS)[number];
export const SPEED_RATES: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.85, fast: 1 };
/** A line said slowly is this much slower than the speed the player chose… */
export const SLOW_RATE_FACTOR = 0.75;
/** …and never slower than this. */
export const SLOWEST_RATE = 0.5;

/** The rate a clip plays at: the player's speed, or that much slower for a line marked slow. */
export function playbackRate(speed: SpeechSpeed, slow = false): number {
  return Math.max(SLOWEST_RATE, SPEED_RATES[speed] * (slow ? SLOW_RATE_FACTOR : 1));
}

/** The next speed along, wrapping round: the settings row cycles with it. */
export function nextSpeed(speed: SpeechSpeed): SpeechSpeed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}
```

- [ ] **Step 4: Carry the two preferences in `packages/view/src/choose.ts`**

Add at the top, after the existing imports:
```ts
import { SPEEDS, type SpeechSpeed } from "./audio";
```
and replace the `PlayerSettings` interface and the tail of `parseSettings` with:
```ts
/** What the player chose, kept apart from any course's saves. */
export interface PlayerSettings {
  /** the course being learned */
  course?: string;
  /** the reading language */
  learner?: string;
  /** how fast clips play, on either web page */
  speed?: SpeechSpeed;
  /** the visual novel moves on by itself */
  autoAdvance?: boolean;
}
```
```ts
  if (typeof d.course === "string") out.course = d.course;
  if (typeof d.learner === "string") out.learner = d.learner;
  if (typeof d.speed === "string" && (SPEEDS as readonly string[]).includes(d.speed)) out.speed = d.speed as SpeechSpeed;
  if (typeof d.autoAdvance === "boolean") out.autoAdvance = d.autoAdvance;
  return out;
```

- [ ] **Step 5: Export the values from `packages/view/src/index.ts`**

Replace:
```ts
export type { AudioOut, Speech } from "./audio";
```
with:
```ts
export * from "./audio";
```

- [ ] **Step 6: Run the tests and the whole suite**

```bash
npx vitest run packages/view/test/audio.test.ts packages/view/test/choose.test.ts && npm test
```
Expected: PASS, and the full suite green (nothing consumes the new names yet).

- [ ] **Step 7: Commit**

```bash
git add packages/view
git commit -m "view: a speech speed, and settings that carry it" -m "Slow, normal and fast, with a line said slowly playing 0.75 of the chosen
speed and never under 0.5. The two web pages keep the choice in the player's
settings beside the course and the reading language." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The web audio plays at that speed, and says when it is busy

**Files:**
- Modify: `packages/web-common/src/web-audio.ts`
- Modify: `packages/web-common/test/web-audio.test.ts`

**Interfaces:**
- Consumes: `SLOW_RATE_FACTOR`, `SLOWEST_RATE` from `@silver-tongue/view` (a value import now, not a type-only one; `web-common` already depends on that package).
- Produces: `WebAudioDeps.rate?: () => number` (default 1) and `AudioOut.busy`, true from `play()` until the last clip ends.

- [ ] **Step 1: Write the failing tests**

In `packages/web-common/test/web-audio.test.ts`, **change the first test**, whose old expectation (rate 0.8 for a slow line) is exactly what this task changes:
```ts
  it("plays clips in order with a 300 ms beat, slow lines 0.75 slower", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait }).play([{ clips: ["x"] }, { clips: ["y"], slow: true }, { clips: ["z"] }]);
    el.onended!();
    expect(waits[0].ms).toBe(300);
    waits[0].cb();
    el.onended!();
    waits[1].cb();
    expect(el.played).toEqual([
      { src: "audio/x.mp3", rate: 1 },
      { src: "audio/y.mp3", rate: 0.75 },
      { src: "audio/z.mp3", rate: 1 },
    ]);
  });
```
(`0.75` is `SLOW_RATE_FACTOR` with no `rate` dep, i.e. rate 1.)

Then add three tests inside the same `describe`:
```ts
  it("plays at the speed the player chose, and a slow line 0.75 slower", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait, rate: () => 0.7 }).play([{ clips: ["x"] }, { clips: ["y"], slow: true }]);
    el.onended!();
    waits[0].cb();
    expect(el.played).toEqual([{ src: "audio/x.mp3", rate: 0.7 }]);
    expect(el.played[1].rate).toBeCloseTo(0.525);
  });

  it("asks for the rate again for every clip, so a change takes at once", () => {
    const el = fakeEl();
    let rate = 0.7;
    const { waits, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait, rate: () => rate }).play([{ clips: ["x", "y"] }]);
    el.onended!();
    rate = 1;
    waits[0].cb();
    expect(el.played.map((p) => p.rate)).toEqual([0.7, 1]);
  });

  it("is busy from play() until the last clip ends, never with no audio element", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    expect(a.busy).toBe(false);
    a.play([{ clips: ["x", "y"] }]);
    expect(a.busy).toBe(true);
    el.onended!();
    expect(a.busy).toBe(true); // the second clip is queued
    waits[0].cb();
    el.onended!();
    expect(a.busy).toBe(false);
    a.play([{ clips: ["x"] }]);
    a.stop();
    expect(a.busy).toBe(false);
    const silent = createWebAudio({ base: "audio/", audio: undefined, wait: timers().wait });
    silent.play([{ clips: ["x"] }]);
    expect(silent.busy).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
npx vitest run packages/web-common/test/web-audio.test.ts
```
Expected: FAIL — `rate` is not in `WebAudioDeps` (excess property, or the rate expectations are 1 and 0.8), and `a.busy` is `undefined`.

- [ ] **Step 3: Implement it in `packages/web-common/src/web-audio.ts`**

Change the first line to:
```ts
import { SLOW_RATE_FACTOR, SLOWEST_RATE, type AudioOut, type Speech } from "@silver-tongue/view";
```
Add to `WebAudioDeps`, after `wait`:
```ts
  /** how fast to play, asked for each clip so a change in settings takes at once */
  rate?: () => number;
```
Add a flag beside `let queue`, and set it in `next`, `done` and `stop`:
```ts
  let speaking = false;
```
```ts
  const next = (mine: number) => {
    timer = undefined;
    if (mine !== run || !el) return;
    const item = queue.shift();
    if (!item) return;
    speaking = true;
    const done = () => {
      if (mine !== run) return;
      if (queue.length) {
        timer = deps.wait(BEAT_MS, () => next(mine));
        return;
      }
      speaking = false;
    };
    el.onended = () => {
      fails = 0;
      done();
    };
    el.onerror = () => {
      fails++;
      done();
    };
    el.src = `${deps.base}${item.clip}.mp3`;
    el.defaultPlaybackRate = el.playbackRate = Math.max(SLOWEST_RATE, (deps.rate?.() ?? 1) * (item.slow ? SLOW_RATE_FACTOR : 1));
    // Refused (no key pressed yet): nothing will end, so go on as if it had.
    el.play().catch(() => done());
  };
```
```ts
  const stop = () => {
    run++;
    queue = [];
    speaking = false;
    timer?.cancel();
    timer = undefined;
    el?.pause();
  };
```
and in the returned object, next to `available`, add:
```ts
    get busy() {
      return speaking;
    },
```
Update the doc comment above `createWebAudio` to say: *Plays clips through one audio element, in order with a beat between them, at the rate the page asks for (0.75× that for a slow line).*

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/web-common/test/web-audio.test.ts && npm test
```
Expected: PASS, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/web-common
git commit -m "web-common: clips play at the player's speed, and say when they are busy" -m "The page asks for the rate per clip, so a change in settings takes at once, and
the player says when a clip is playing so the visual novel can wait for it." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The terminal player says when it is busy

**Files:**
- Modify: `packages/tui-node/src/node-audio.ts`
- Modify: `packages/tui-node/test/node-audio.test.ts`

**Interfaces:**
- Produces: `AudioOut.busy` on the node player, so `AudioOut` has no implementation that lies by omission. No other behaviour changes: the terminal game still ignores `Speech.slow` and plays clips as they are (nothing reads the rate there).

- [ ] **Step 1: Write the failing test**

Add inside `describe("createNodeAudio")` in `packages/tui-node/test/node-audio.test.ts`:
```ts
  it("is busy from play() until the last clip finishes, and not after stop()", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    expect(a.busy).toBe(false);
    a.play([{ clips: ["x", "y"] }]);
    expect(a.busy).toBe(true);
    f.spawned[0].proc.exit();
    expect(a.busy).toBe(true); // the second clip is queued
    f.waits[0].cb();
    f.spawned[1].proc.exit();
    expect(a.busy).toBe(false);
    a.play([{ clips: ["z"] }]);
    a.stop();
    expect(a.busy).toBe(false);
  });

  it("is not busy once the player is broken", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x"] }]);
    f.spawned[0].proc.fail();
    expect(a.busy).toBe(false);
  });
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run packages/tui-node/test/node-audio.test.ts
```
Expected: FAIL — `a.busy` is `undefined`, so `toBe(true)` fails.

- [ ] **Step 3: Implement it in `packages/tui-node/src/node-audio.ts`**

This player already holds both facts a `busy` needs, so the getter reads them rather than adding a flag that could drift: `proc` is set while a clip runs and cleared on exit and in `stop()`; `timer` covers the 300 ms beat and is cleared in `next()` and `stop()`. Copy the public shape from `packages/web-common/src/web-audio.ts`, not the mechanism — a separate `speaking` flag would be a third copy of the same truth to keep in step.

Add the getter next to `available` in the returned object, and nothing else:
```ts
    get busy() {
      return !broken && (proc !== undefined || timer !== undefined);
    },
```
Check the existing test double first: `fakes()` returns `{ spawned, waits, spawn, wait }` and its `waits` entries already carry a `cancelled` flag, so `stop()` during the beat is assertable. Add that one case too, mirroring `packages/tui-web`'s existing sibling coverage:

```ts
  it("stops dead in the beat between clips: the next clip never starts", () => {
    const f = fakes();
    const a = createNodeAudio({ dir: "/a", player, ...f });
    a.play([{ clips: ["x", "y"] }]);
    f.spawned[0].proc.exit();
    a.stop();
    expect(a.busy).toBe(false);
    expect(f.waits[0].cancelled).toBe(true);
    f.waits[0].cb(); // a timer that fires anyway does nothing
    f.spawned[0].proc.exit();
    expect(f.spawned).toHaveLength(1);
  });
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/tui-node/test/node-audio.test.ts && npm test && npm run typecheck
```
Expected: PASS, whole suite green, types clean.

- [ ] **Step 5: Commit**

```bash
git add packages/tui-node
git commit -m "tui-node: the player says what it is playing" -m "The same busy as the web player, so nothing depends on a page to answer. The
terminal game still plays clips as they are: it has no speed setting yet." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Remembering a course must not forget the rest

**Files:**
- Modify: `packages/web-common/src/web-storage.ts`, `packages/web-common/test/web-storage.test.ts`
- Modify: `packages/vn-web/src/main.tsx:67`, `packages/tui-web/src/main.ts:154`

**Interfaces:**
- Produces: `updateWebSettings(kv: KeyValue, patch: Partial<PlayerSettings>): PlayerSettings` — loads, spreads, saves, returns the result. `saveWebSettings` stays for writing a whole object (the tests use it).

- [ ] **Step 1: Write the failing test**

Add inside `describe("settings and old course ids")` in `packages/web-common/test/web-storage.test.ts` (add `updateWebSettings` to that file's import from `../src/web-storage`):
```ts
  it("changes one setting without losing the others", () => {
    const kv = new FakeStorage();
    saveWebSettings(kv, { course: "zh-china", learner: "en", speed: "slow", autoAdvance: true });
    expect(updateWebSettings(kv, { course: "zh-other" })).toEqual({
      course: "zh-other",
      learner: "en",
      speed: "slow",
      autoAdvance: true,
    });
    expect(loadWebSettings(kv).speed).toBe("slow");
  });
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run packages/web-common/test/web-storage.test.ts
```
Expected: FAIL — `updateWebSettings` is not exported.

- [ ] **Step 3: Implement it in `packages/web-common/src/web-storage.ts`**

Add after `saveWebSettings`:
```ts
/**
 * The settings with a few fields changed. Both pages remember a course here, which used to
 * replace the whole object and lose the speech speed and the auto-advance choice.
 */
export function updateWebSettings(kv: KeyValue, patch: Partial<PlayerSettings>): PlayerSettings {
  const settings = { ...loadWebSettings(kv), ...patch };
  saveWebSettings(kv, settings);
  return settings;
}
```
`packages/web-common/src/index.ts` already does `export * from "./web-storage"`, so the new name reaches both pages with no edit there.

- [ ] **Step 4: Use it in both pages instead of the whole-object write**

`packages/vn-web/src/main.tsx` line 67:
```ts
  if (remember) updateWebSettings(kv, { course: l.course.id, learner: l.course.learner });
```
`packages/tui-web/src/main.ts` line 154:
```ts
  if (remember) updateWebSettings(kv, { course: course.id, learner: course.learner });
```
and add `updateWebSettings` to each file's import from `@silver-tongue/web-common` (drop `saveWebSettings` from those imports if nothing else in the file uses it — check with `grep -n saveWebSettings`).

- [ ] **Step 5: Run the tests**

```bash
npx vitest run packages/web-common/test/web-storage.test.ts && npm run typecheck && npm test
```
Expected: PASS and clean.

- [ ] **Step 6: Commit**

```bash
git add packages/web-common packages/vn-web/src/main.tsx packages/tui-web/src/main.ts
git commit -m "web-common: remembering a course keeps the rest of the settings" -m "Both pages wrote the whole settings object when they remembered a course, which
would have lost the speed and the auto-advance choice on the next visit." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The text page speaks at that speed

**Files:**
- Modify: `packages/tui-web/src/main.ts`

**Interfaces:**
- Consumes: `playbackRate`, `SpeechSpeed` from `@silver-tongue/tui` (which re-exports view).

- [ ] **Step 1: Write the failing test**

There is no unit test for `tui-web`'s wiring (it is a DOM module with no component tests). The check is `npm run typecheck` plus Task 10's manual browser pass, so this task is: change the code, then verify the types.

- [ ] **Step 2: Make the change**

In `packages/tui-web/src/main.ts`, add to the `@silver-tongue/tui` import list: `playbackRate`, and `type SpeechSpeed`. Then add a module-level value beside `let audio: ReturnType<typeof createWebAudio> | undefined;`:
```ts
/** How fast clips play, from the player's settings; the audio asks for it per clip. */
let speed: SpeechSpeed = "slow";
```
and in `fetchCourse`, add one line to the `createWebAudio` call:
```ts
    audio: createWebAudio({
      base: `${base}${entry.id}/audio/`,
      audio: typeof Audio === "undefined" ? undefined : new Audio(),
      wait: (ms, cb) => {
        const h = setTimeout(cb, ms);
        return { cancel: () => clearTimeout(h) };
      },
      rate: () => playbackRate(speed),
    }),
```
and in `boot()`, right after `const settings = loadWebSettings(kv);`:
```ts
  speed = settings.speed ?? "slow";
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm test
```
Expected: clean, green.

- [ ] **Step 4: Commit**

```bash
git add packages/tui-web
git commit -m "tui-web: clips play at the speed the player chose" -m "The text page reads the same speed out of the player's settings as the visual
novel, so one choice covers both." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: How long a beat stays up

**Files:**
- Create: `packages/vn-web/src/dwell.ts`, `packages/vn-web/test/dwell.test.ts`

**Interfaces:**
- Produces: `dwellMs(beat: Beat): number` — 900ms + 300ms a word for a line in the language being learned, 900ms + 45ms a character for narration, clamped to 1400…7000.
- `dwell.ts` imports the `Beat` type from `./vn` with `import type`, which erases at compile time; `vn.ts` imports `dwellMs` from `./dwell`. There is no runtime cycle.

- [ ] **Step 1: Write the failing test**

`packages/vn-web/test/dwell.test.ts` (new file):
```ts
import { describe, expect, it } from "vitest";
import type { RenderedLine } from "@silver-tongue/core";
import { dwellMs } from "../src/dwell";

/** A line of `words` tokens, as the controller hands them over. */
const line = (words: number): RenderedLine => ({
  text: "你好！",
  tokens: Array.from({ length: words }, (_, i) => ({ start: i, end: i + 1, word: `w${i}` as RenderedLine["tokens"][number]["word"] })),
});

describe("dwellMs", () => {
  it("gives a line 900ms plus 300ms a word", () => {
    expect(dwellMs({ line: line(3) })).toBe(1800);
    expect(dwellMs({ line: line(9) })).toBe(3600);
  });

  it("gives narration 900ms plus 45ms a character", () => {
    expect(dwellMs({ text: "x".repeat(20) })).toBe(1800);
  });

  it("never goes under 1.4 seconds or over 7", () => {
    expect(dwellMs({ text: "x" })).toBe(1400);
    expect(dwellMs({ line: line(1) })).toBe(1400);
    expect(dwellMs({ text: "x".repeat(200) })).toBe(7000);
    expect(dwellMs({ line: line(40) })).toBe(7000);
  });

  it("has nothing to wait for with no text at all", () => {
    expect(dwellMs({})).toBe(1400);
  });
});
```
(20 characters: 900 + 20 × 45 = 1800, same as 3 words — the two rules meet, which is the point of the shared base.)

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run packages/vn-web/test/dwell.test.ts
```
Expected: FAIL — cannot resolve `../src/dwell`.

- [ ] **Step 3: Implement it**

`packages/vn-web/src/dwell.ts`:
```ts
import type { Beat } from "./vn";

const BASE_MS = 900;
const WORD_MS = 300;
const CHAR_MS = 45;
const MIN_MS = 1400;
const MAX_MS = 7000;

/**
 * How long a beat stays up: 900ms plus 300ms for each word of a line in the language being
 * learned, or 45ms for each character of narration, between 1.4 and 7 seconds. A beat with a clip
 * waits longer still, for the sound to finish.
 */
export function dwellMs(b: Beat): number {
  const raw = b.line ? BASE_MS + b.line.tokens.length * WORD_MS : BASE_MS + (b.text?.length ?? 0) * CHAR_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, raw));
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run packages/vn-web/test/dwell.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vn-web/src/dwell.ts packages/vn-web/test/dwell.test.ts
git commit -m "vn-web: a reading time for a line" -m "900ms plus 300ms a word of a line, or 45ms a character of narration, between
1.4 and 7 seconds, with the numbers in one place the controller can test." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The scene moves on by itself

**Files:**
- Modify: `packages/vn-web/src/vn.ts`
- Modify: `packages/vn-web/test/vn.test.ts`

**Interfaces:**
- Consumes: `dwellMs` (Task 6), `AudioOut.busy` (Tasks 2–3).
- Produces: `VnOptions.wait?: (ms, cb) => { cancel(): void }` (default `setTimeout`), `VnOptions.autoAdvance?: boolean` (default `true`), `Vn.hold(held: boolean): void`, `Vn.setAuto(on: boolean): void`.

- [ ] **Step 1: Write the failing tests**

In `packages/vn-web/test/vn.test.ts`, add near the top, after `skip`:
```ts
import { dwellMs } from "../src/dwell";

/** Timers the test fires by hand; a cancelled one does nothing, like clearTimeout. */
function clock() {
  const pending: { ms: number; fire: () => void; cancelled: boolean }[] = [];
  const wait = (ms: number, cb: () => void) => {
    const w = { ms, fire: () => !w.cancelled && cb(), cancelled: false };
    pending.push(w);
    return { cancel: () => void (w.cancelled = true) };
  };
  return { pending, wait, last: () => pending.at(-1)! };
}
```
Move the `import { dwellMs }` line up with the other imports (TypeScript allows imports anywhere at the top level, but keep them together).

Then add these six tests inside `describe("visual novel controller")`:
```ts
  it("moves on by itself once the line has had its reading time", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    const p = s.vn.view().phase;
    expect(p.kind).toBe("beat");
    if (p.kind !== "beat") return;
    expect(c.pending).toHaveLength(1);
    expect(c.pending[0].ms).toBe(dwellMs(p.beat));
    c.pending[0].fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("stays until the clip has finished, then 200ms", () => {
    const c = clock();
    let busy = true;
    const audio = { available: true, get busy() { return busy; }, play: () => {}, stop: () => {} };
    const s = setup(undefined, undefined, { wait: c.wait, audio });
    c.pending[0].fire(); // the reading time is up, the clip is still going
    expect(s.vn.view().phase.kind).toBe("beat");
    expect(c.last().ms).toBe(200);
    busy = false;
    c.last().fire();
    expect(c.last().ms).toBe(200); // the pad after the sound
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("waits while an overlay is open, and gives the line its time again after", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    s.vn.hold(true);
    expect(c.pending).toHaveLength(1); // the one armed while the first beat was shown
    c.pending[0].fire(); // cancelled: the line stays
    expect(s.vn.view().phase.kind).toBe("beat");
    s.vn.hold(false);
    expect(c.pending).toHaveLength(2);
    c.last().fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });

  it("waits for a press on the day card", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    skip(s.vn);
    const p = s.vn.view().phase;
    if (p.kind === "explore") s.vn.choose(p.menu.findIndex((m) => m.kind === "sleep"));
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { day: 2 } });
    expect(c.pending).toHaveLength(0);
  });

  it("waits for a press on every line when auto-advance is off", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait, autoAdvance: false });
    expect(c.pending).toHaveLength(0);
    s.vn.advance();
    expect(c.pending).toHaveLength(0);
    s.vn.setAuto(true);
    expect(c.pending).toHaveLength(1);
  });

  it("a press takes the line straight away, and the timer it cancelled does nothing after", () => {
    const c = clock();
    const s = setup(undefined, undefined, { wait: c.wait });
    const first = c.pending[0];
    s.vn.advance();
    expect(c.pending).toHaveLength(2);
    first.fire();
    expect(s.vn.view().phase).toMatchObject({ kind: "beat", beat: { text: "An old man on a bench is watching you with open curiosity." } });
  });
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
npx vitest run packages/vn-web/test/vn.test.ts
```
Expected: FAIL — `wait`, `hold` and `setAuto` are not on `VnOptions`/`Vn` (TypeScript errors are not raised by vitest, so the failures are runtime: `c.pending` is empty and `s.vn.hold is not a function`).

- [ ] **Step 3: Implement the timer in `packages/vn-web/src/vn.ts`**

Add the import next to the others at the top:
```ts
import { dwellMs } from "./dwell";
```
In `VnOptions`, after `now`:
```ts
  /** timers, so a test can fire them by hand */
  wait?: (ms: number, cb: () => void) => { cancel(): void };
```
and after `notice`:
```ts
  /** the scene moves on by itself; false waits for a press on every line */
  autoAdvance?: boolean;
```
In the `Vn` interface, after `advance(): void;`:
```ts
  /** an overlay, a card or a hidden tab: the line waits for the player */
  hold(held: boolean): void;
  /** the player turned auto-advance on or off in settings */
  setAuto(on: boolean): void;
```
In `createVn`, after `let save = opts.save;`:
```ts
  const wait = opts.wait ?? ((ms, cb) => { const h = setTimeout(cb, ms); return { cancel: () => clearTimeout(h) }; });
  let timer: { cancel(): void } | undefined;
  let held = false;
  let auto = opts.autoAdvance !== false;
```
Add the three functions just before `function show()`:
```ts
  const disarm = () => {
    timer?.cancel();
    timer = undefined;
  };

  /** Arms the timer for a beat: its reading time, then the sound, then a short pad. */
  function arm(b: Beat) {
    disarm();
    if (!auto || held || b.day !== undefined) return; // a new day is always a press
    const go = () => {
      timer = undefined;
      if (opts.audio?.busy) {
        timer = wait(200, go);
        return;
      }
      timer = wait(200, () => {
        timer = undefined;
        if (!held) advance();
      });
    };
    timer = wait(dwellMs(b), go);
  }
```
Rewrite `show()` so the beat arms the timer and an empty queue disarms it. Keep the `shownAt` line at the end: it is what makes menus ignore a double tap for 350 ms (commit 13ee7d6).
```ts
  /** Shows the next beat, or, when there is none, lets the NPC leave or listen. */
  function show() {
    current = queue.shift();
    if (current) {
      log(current);
      if (current.cue) cue = current.cue;
      say(current.speech);
      arm(current);
      return;
    }
    disarm();
    if (leaving) {
      npc = undefined;
      leaving = false;
    }
    if (reply) cue = "listen";
    shownAt = opts.now();
  }
```
The timer never runs on a menu or a reply screen, because `arm` is only called for a beat and an empty queue disarms. So the 350 ms double-tap guard still covers a reply the player taps straight after the line before it.
Turn `advance` from a method in the returned object into a closure, so `arm` can call it: add above `function show()`:
```ts
  function advance() {
    if (!current || naming) return;
    disarm();
    show();
    changed();
  }
```
and in the returned object replace
```ts
    advance() {
      if (!current || naming) return;
      show();
      changed();
    },
```
with
```ts
    advance,
    hold(on) {
      if (on === held) return;
      held = on;
      if (on) disarm();
      else if (current) arm(current);
    },
    setAuto(on) {
      auto = on;
      if (auto && current) arm(current);
      else disarm();
      changed();
    },
```
Check every other method that swaps the beat also disarms: `choose`, `talkTo`, `sendTiles` and `setName` all go through `send()` → `show()`, which disarms and re-arms; `placeTile` and `undoTile` do not swap the beat and must leave the timer alone.

- [ ] **Step 4: Run the tests**

```bash
npx vitest run packages/vn-web/test && npm run typecheck && npm test
```
Expected: PASS, clean, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/vn-web/src/vn.ts packages/vn-web/test/vn.test.ts
git commit -m "vn-web: the scene moves on by itself" -m "Each beat gets its reading time, then the sound if there is any, then a short
pad. An overlay, a card, another tab, the name box, a new day or a beat with
replies waits for the player, and a press still takes the line at once." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Speed and auto-advance in settings, and holding while an overlay is open

**Files:**
- Modify: `packages/vn-web/src/main.tsx`, `packages/vn-web/src/ui/App.tsx`, `packages/vn-web/src/ui/Overlays.tsx`
- Modify: `packages/view/src/text.ts` (`VN_UI_KEYS`), `content/learner/en/ui.ftl`

**Interfaces:**
- Consumes: `nextSpeed` (Task 1), `parseSettings`/`updateWebSettings` (Task 4), `Vn.hold`/`setAuto` (Task 7).
- Produces: `Page.prefs: { speed: SpeechSpeed; autoAdvance: boolean }` and `Page.setPref(patch: Partial<Page["prefs"]>): void`.
- Produces the strings `vn-speed`, `vn-speed-slow`, `vn-speed-normal`, `vn-speed-fast`, `vn-advance`, `vn-advance-auto`, `vn-advance-tap`.

- [ ] **Step 1: Add the new ids to `VN_UI_KEYS`, without their lines yet**

`packages/view/test/text.test.ts` already checks that the English UI file defines every visual novel message, so listing the ids is what turns this red.

In `packages/view/src/text.ts`, inside `VN_UI_KEYS`, after `"vn-sound": []`:
```ts
  "vn-speed": ["speed"],
  "vn-speed-slow": [],
  "vn-speed-normal": [],
  "vn-speed-fast": [],
  "vn-advance": ["mode"],
  "vn-advance-auto": [],
  "vn-advance-tap": [],
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx vitest run packages/view/test/text.test.ts
```
Expected: FAIL — `learner text: missing "vn-speed"` (and the other six) from "the English UI file has every visual novel message too".

- [ ] **Step 3: Add the strings to `content/learner/en/ui.ftl`**

After the `vn-sound = Sound` line:
```ftl
vn-speed = Speed: { $speed }
vn-speed-slow = slow
vn-speed-normal = normal
vn-speed-fast = fast
vn-advance = Advance: { $mode }
vn-advance-auto = by itself
vn-advance-tap = one press at a time
```

- [ ] **Step 4: Run the test to see it pass**

```bash
npx vitest run packages/view/test/text.test.ts
```
Expected: PASS. Then `npm run build:course` also passes with no errors (the clips list is unchanged, so no audio is needed).

- [ ] **Step 5: Own the preferences in `packages/vn-web/src/main.tsx`**

Add to the `@silver-tongue/web-common` import: `updateWebSettings` (drop `saveWebSettings` if it is no longer used in the file). Extend the `@silver-tongue/view` import (line 1) with `playbackRate`, `nextSpeed` and `type SpeechSpeed`.

Add beside `let current: {...} | undefined;`:
```ts
/** The player's reading preferences, kept in their own settings, not in a game. */
let prefs = { speed: "slow" as SpeechSpeed, autoAdvance: true };
```
In `boot()`, after `const settings = loadWebSettings(kv);`:
```ts
  prefs = { speed: settings.speed ?? "slow", autoAdvance: settings.autoAdvance ?? true };
```
In `load()`, add one line to this page's own `createWebAudio` call (line 51) so a clip on **this** page honours the speed row — without it the visual novel, the one page with the setting, would play at the old rate:
```ts
      rate: () => playbackRate(prefs.speed),
```
In `play(opened)`, add `autoAdvance: prefs.autoAdvance,` to the `createVn({ … })` call, and add these two lines to the `page` object:
```ts
    prefs,
    setPref: (patch) => {
      prefs = { ...prefs, ...patch };
      updateWebSettings(kv, patch);
    },
```

- [ ] **Step 6: Hold the line while something else is on screen, in `packages/vn-web/src/ui/App.tsx`**

Add `import type { SpeechSpeed } from "@silver-tongue/view";` (or extend the existing `@silver-tongue/view` import if there is one; this file imports `@silver-tongue/core` and local modules today).

In the `Page` interface, after `audioAvailable: boolean;`:
```ts
  /** the player's speed and auto-advance choices, already resolved */
  prefs: { speed: SpeechSpeed; autoAdvance: boolean };
  setPref(patch: Partial<Page["prefs"]>): void;
```
Add this effect after the keyboard effect:
```ts
  // The scene waits for the player while a notebook, a card or another tab has their attention.
  useEffect(() => {
    const held = () => !!overlay || !!card || document.hidden;
    const sync = () => vn.hold(held());
    sync();
    addEventListener("visibilitychange", sync);
    return () => {
      removeEventListener("visibilitychange", sync);
      vn.hold(false);
    };
  }, [vn, overlay, card]);
```

- [ ] **Step 7: Add the two rows to the settings overlay, in `packages/vn-web/src/ui/Overlays.tsx`**

Extend the `@silver-tongue/view` import on line 3 with `nextSpeed`, `type SpeechSpeed` (unused as a type here, so just `nextSpeed`).

In `Menu`, between the `rows.map` block and the Games row (line 82), add:
```tsx
      {screen === "main" && <button type="button" class="row" onClick={() => page.setPref({ speed: nextSpeed(page.prefs.speed) })}>{vn.t("vn-speed", { speed: vn.t(`vn-speed-${page.prefs.speed}`) })}</button>}
      {screen === "main" && <button type="button" class="row" onClick={() => {
        const autoAdvance = !page.prefs.autoAdvance;
        page.setPref({ autoAdvance });
        vn.setAuto(autoAdvance);
      }}>{vn.t("vn-advance", { mode: vn.t(page.prefs.autoAdvance ? "vn-advance-auto" : "vn-advance-tap") })}</button>}
```
The speed row needs no `vn.setAuto`: the timer asks `page.prefs.speed` per clip through the audio, and only the advance row changes the timer. `SpeechSpeed` is not needed in this file.

- [ ] **Step 8: Verify**

```bash
npm run typecheck && npm test && npm run build:course
```
Expected: clean, green, build with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/view/src/text.ts content/learner/en/ui.ftl packages/vn-web
git commit -m "vn-web: speed and auto-advance in settings" -m "Two rows on the settings screen, remembered beside the course, and the scene
waits while a notebook, a card or a hidden tab has the player's attention." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The place menu is navigation; replies are speech

**Files:**
- Create: `packages/vn-web/src/ui/Replies.tsx`, `packages/vn-web/src/ui/PlaceMenu.tsx`
- Delete: `packages/vn-web/src/ui/Choices.tsx`
- Modify: `packages/vn-web/src/ui/App.tsx` (the render), `packages/vn-web/src/vn.css`

**Interfaces:**
- Consumes: `View` phases `pick` and `explore`, `vn.choose(n)`, `vn.t`, `Line` (unchanged).
- Produces: `<Replies vn view onWord />` and `<PlaceMenu vn view />`. No test covers these components (there are no Preact component tests in this repo); the check is `npm run typecheck` plus the manual pass in Task 10.

- [ ] **Step 1: Create `packages/vn-web/src/ui/Replies.tsx`**

```tsx
import type { WordId } from "@silver-tongue/core";
import type { Vn, VnView } from "../vn";
import { Line } from "./Line";

/** What you can say back: one big card per reply, its words tappable for help. */
export function Replies({ vn, view, onWord }: { vn: Vn; view: VnView; onWord: (w: WordId) => void }) {
  if (view.phase.kind !== "pick") return null;
  return (
    <div class="replies">
      {view.phase.options.map((o, i) => (
        <div key={i} class="reply-card" role="button" tabIndex={0} onClick={() => vn.choose(i)} onKeyDown={(e) => e.key === "Enter" && vn.choose(i)}>
          <span class="key">{i + 1}</span><Line line={o} onWord={onWord} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `packages/vn-web/src/ui/PlaceMenu.tsx`**

```tsx
import type { Vn, VnView } from "../vn";

/**
 * Where you can go: one quiet row per thing, numbered, travel marked with an arrow, and what you
 * cannot afford greyed out with the reason. It sits under the stage, not over it.
 */
export function PlaceMenu({ vn, view }: { vn: Vn; view: VnView }) {
  if (view.phase.kind !== "explore") return null;
  return (
    <div class="place-menu">
      {view.phase.waiting.map((w) => <div key={w} class="place-item waiting" aria-disabled="true">{w}</div>)}
      {view.phase.menu.map((m, i) => (
        <button key={i} type="button" class={`place-item kind-${m.kind}`} onClick={() => vn.choose(i)}>
          <span class="key">{i + 1}</span>{m.kind === "go" ? "→ " : ""}{m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Render the two, and drop the old component**

In `packages/vn-web/src/ui/App.tsx`, replace the import
```tsx
import { Choices } from "./Choices";
```
with
```tsx
import { PlaceMenu } from "./PlaceMenu";
```
and add, in alphabetical position with the other ui imports:
```tsx
import { Replies } from "./Replies";
```
then replace
```tsx
      <Choices vn={vn} view={view} onWord={onWord} />
```
with
```tsx
      <PlaceMenu vn={vn} view={view} />
      <Replies vn={vn} view={view} onWord={onWord} />
```
```bash
git rm packages/vn-web/src/ui/Choices.tsx
```

- [ ] **Step 4: Restyle in `packages/vn-web/src/vn.css`**

Replace the three `.choices`/`.choice` rules (lines 41–44) with:
```css
/* Replies are speech: big cards over the right of the stage, clear of whoever stands centre-left. */
.replies { position: absolute; right: 3%; top: 12%; width: 40%; max-height: 58%; overflow: auto; display: flex; flex-direction: column; gap: 1.2cqh; }
.reply-card { display: flex; align-items: center; gap: 1.2cqw; padding: 1.3cqh 1.6cqw; border-radius: 1.2cqh; background: #10131bdd; border: 0.2cqh solid #ffffff2a; text-align: left; font-size: 3.4cqh; cursor: pointer; }
.reply-card:hover { border-color: var(--accent); }
/* The place menu is navigation: a quiet list above the box, in the band the tiles use. */
.place-menu { position: absolute; right: 3%; bottom: 29%; width: 34%; max-height: 46%; overflow: auto; display: flex; flex-direction: column; gap: 0.3cqh; }
.place-item { display: flex; align-items: center; gap: 1cqw; padding: 0.7cqh 1cqw; border-left: 0.2cqh solid #ffffff33; background: none; text-align: left; font-size: 2.4cqh; color: #d8dce4; cursor: pointer; }
.place-item:hover { border-left-color: var(--accent); color: var(--text); }
.place-item.waiting { opacity: 0.55; cursor: default; }
```
Leave the `.key` rule alone: both look right with it. `.tiles` already sits at `bottom: 29%`, and the place menu and the tiles are never on screen together.

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm test && npm run build:vn
```
Expected: clean, green, and `packages/vn-web/dist/index.html` rebuilt.

- [ ] **Step 6: Commit**

```bash
git add packages/vn-web
git commit -m "vn-web: the place menu is navigation, replies are speech" -m "The NPCs stand centre-left and the two are never on screen together, so the
place menu can be the quiet list above the dialogue box that it always wanted
to be, and the replies can be big cards." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: An intro that says 1980

**Files:**
- Modify: `content/learner/en/narration-china-city.ftl:2-5`

**Interfaces:**
- `introLines` in `view/src/narration.ts` needs no change: it reads `intro-1`, `intro-2`, … while they exist and passes `{ currency, wallet, rent }`, so keep using all three variables.

- [ ] **Step 1: Rewrite the four lines**

Replace `intro-1` … `intro-4` with:
```ftl
intro-1 = China, 1980. There is no phone in your pocket, no translator in your bag, and nobody on this street who speaks your language: whatever you have to say, you will say it in Chinese.
intro-2 = You have { $currency }{ $wallet }. There is a room for you down the street; the rent, { $currency }{ $rent }, falls due at the end of each week, and food costs money every day.
intro-3 = There is work in the noodle shop, at the warehouse, out on the road. It needs words, and words get you paid in full only when you get them right the first time.
intro-4 = On a bench by the road an old man is watching you with open curiosity. Maybe start there.
```
Keep the comment line above them (`# The story. intro-1, intro-2, … open a new game …`).

- [ ] **Step 2: Build the course**

```bash
npm run build:course
cd site && python3 -m http.server 8123
```
(`site/` and `dist/` are gitignored build output, so a fresh checkout needs `npm run build:course` before `npm run build:site`.)
Expected: PASS with no errors, and `dist/courses/zh-china/en.json` rewritten.

- [ ] **Step 3: Play it, by hand, in a browser**

```bash
npm run build:site
cd site && python3 -m http.server 8123
```
Then in the browser at `http://localhost:8123/`:
1. New game → name yourself → the four intro lines read as 1980, with the numbers from the course.
2. Press nothing: the scene plays itself line by line, and each line with a clip stays until you have heard it.
3. Open the notebook on a line: the line waits; close it and it still has its full time.
4. Settings shows `Speed: slow` and `Advance: by itself`; pressing Speed cycles slow → normal → fast, pressing the line above it turns auto-advance off, and both survive a reload.
5. While exploring, the place menu is a small dim list above the box; in a scene, the replies are big cards. Neither looks like the other, and `1`…`9` still pick both.
6. `/text/` plays the same saved game, and the clips there are at the same speed.
7. Reload mid-scene: the save continues the scene and the timer works on the resumed line.

- [ ] **Step 4: Commit**

```bash
git add content/learner/en/narration-china-city.ftl
git commit -m "content: an intro that says 1980" -m "The story opens by saying where and when you are, what you have, and what the
work needs from you, instead of three lines of atmosphere." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Commit only the `.ftl`: `dist/` is gitignored build output, and CLAUDE.md's rule is to re-run the build, never to commit it.

---

### Task 11: Release 0.15.0

**Files:**
- Modify: `CHANGELOG.md`, `packages/tui-node/package.json`, `package-lock.json`
- Then, only with the owner's OK: push, and close issues #6, #7, #8, #9.

- [ ] **Step 1: Write the changelog entry**

At the top of `CHANGELOG.md`, under the "Every release of Silver Tongue, newest first." line, add:
```md
## 0.15.0 (2026-09-27)

- The visual novel now plays itself. Each line stays as long as it takes to read it and to hear it said, and a tap still hurries it on. If you would rather choose every line, turn it off in settings.
- Speech starts slow, so there is time to copy what you hear. Settings has a speed choice — slow, normal or fast — and the text game at /text/ plays at the same speed.
- The place menu and your replies no longer look like the same button: your replies are big cards, and the place menu is a quiet list of where you can go.
- The intro now says where and when you are: China, 1980, with no phone, no translator and nobody who speaks your language.
```

- [ ] **Step 2: Commit the entry on its own**

```bash
git add CHANGELOG.md
git commit -m "docs: 0.15.0 changelog" -m "The scene that plays itself, the slow voice, the place menu and the 1980 intro,
in the words a player reads first." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Bump the version**

`packages/tui-node/package.json`: `"version": "0.14.0"` → `"version": "0.15.0"`.
`package-lock.json`: the one line for `packages/tui-node` (around line 1812) likewise.

```bash
npm run typecheck && npm test && npm run build:site
```
Expected: clean, green, site rebuilt (the page footer now reads v0.15.0).

- [ ] **Step 4: Commit the release**

```bash
git add packages/tui-node/package.json package-lock.json
git commit -m "release: 0.15.0" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: With the owner's OK only**

```bash
git push
gh issue close 6 7 8 9
```
