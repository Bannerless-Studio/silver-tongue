# TUI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the text game as a stack of bordered panels (header, HUD, log, word card, reply), with readings that fade as words are learned, a two-column notebook, and a "by Bannerless Studio" credit, and release it as silver-tongue 0.16.1.

**Architecture:** A new `packages/tui/src/panel.ts` lays out a frame of panels and replaces `renderScreen`. `app.ts` keeps all game handling and only changes what it draws. New data (rent countdown, reading row, notebook Recent group and memory bars) lives in `packages/view` so the visual novel can use it later. The `Terminal` interface and core are untouched.

**Tech Stack:** TypeScript, vitest, Fluent (`@fluent/bundle`), npm workspaces. Core is the compiled package `@silver-tongue/core` (`^0.15.1`), not changed.

**Spec:** `docs/superpowers/specs/2026-09-27-tui-revamp-design.md`

All paths below are relative to the `silver-tongue` repo, branch `tui-revamp`.

## Global Constraints

- Core is not touched and not released; every package keeps `@silver-tongue/core@^0.15.1`.
- Release: silver-tongue **0.16.1** (a patch), with a `CHANGELOG.md` entry in plain words.
- The 16 standard ANSI colours only, no background fills. `Color` gains `blue` and `white` (34, 37).
- Every screen works at 40×12. Below 50 columns (`NARROW`) panels lose their side borders.
- Every UI string the TUI uses is in `content/learner/en/ui.ftl` and listed in `UI_KEYS` (`packages/view/src/text.ts`).
- The credit text is exactly `by Bannerless Studio` (Fluent key `credit`).
- `npm test` and `npm run typecheck` pass after every task. Baseline on `main`: 40 files, 453 tests.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CX2neY8phxqqFCDhUJUuTh
  ```

## Differences from the spec (found while planning)

- **Notebook tabs are `[1]` Words / `[2]` Notes, not `[tab]`.** `tui-web` deliberately leaves Tab to the browser so focus can leave the page (`packages/tui-web/src/keys.ts` `forBrowser`).
- **Recent is a separate `recent` field on `Notebook`, not a group.** The visual novel's notebook (`packages/vn-web/src/ui/Overlays.tsx`) draws `groups`; a new group would appear there too.
- **The reading row is also skipped when it only repeats the words** (a Latin-script course whose reading is the word itself).
- **The word card has no base form.** `wordCard` on `main` has no `base` field (that arrives with D2).
- **The second fixture is the spaced course** (`spacedWithText`), not a Japanese one: `main` has no ja course.

## Review Focus

1. A very short terminal (8 rows) in a scene with 3 replies: the frame is exactly `rows` tall and the replies and key hints still show. Pinned in Task 2 (tall panel test) and Task 3 (size sweep includes 40×8).
2. A word card open when the window shrinks: the card is dropped before the log loses its last row, with no crash. Pinned in Task 2 (drop order) and Task 3 (card at 40×8).
3. Long labels at phone width (place names, key hints, CJK lines): no line overflows or cuts a wide character. Pinned in Task 3 and Task 4 size sweeps (`lineWidth(l) === cols` for every line).
4. The notebook after words stop being recent, or with no words at all: the selected group is clamped and the screen still draws. Pinned in Task 4 (group clamp and empty tests).
5. A line with no readings, or whose reading is the word itself: no reading row. Pinned in Task 1 (`readingRow` tests).

---

### Task 1: View data (rent countdown, reading row, notebook bars, HUD strings)

**Files:**
- Modify: `packages/view/src/hud.ts`
- Modify: `packages/view/src/help.ts` (`sentenceCard`, new `lineReading`, `readingRow`)
- Modify: `packages/view/src/notebook.ts`
- Modify: `packages/view/src/text.ts` (`UI_KEYS`)
- Modify: `content/learner/en/ui.ftl`
- Test: `packages/view/test/hud.test.ts`, `packages/view/test/help.test.ts`, `packages/view/test/notebook.test.ts`

**Interfaces:**
- Produces:
  - `HudValues.rentInDays: number`: 0 when rent is due tonight or late.
  - `readingRow(course: Course, state: GameState, line: RenderedLine, now: number): string | undefined`
  - `type NotebookLabel = "new" | "met" | "shaky" | "known"`
  - `NotebookWord.bar: number` (0-5) and `NotebookWord.label: NotebookLabel`
  - `Notebook.recent: NotebookWord[]` (first heard within `DAY_MS` of `now`, newest first)
  - Fluent keys `hud-top` (`day`, `slot`, `slots`), `hud-rent` (`days`), `hud-rent-late`, `hud-parcel`, `credit`

- [ ] **Step 1: Write the failing tests**

In `packages/view/test/hud.test.ts`, change the expected object to include `rentInDays: 0` (rent is late in that test), and add:

```ts
  it("counts the days until rent, which falls at the end of every 7th day", () => {
    const course = fixtureWithText();
    const t = makeText(course.learnerFtl, "en");
    const days = (day: number, rentLate = false) => hudValues(course, { ...newGame(course), day, rentLate }, t, 0).rentInDays;
    expect(days(1)).toBe(6);
    expect(days(6)).toBe(1);
    expect(days(7)).toBe(0);
    expect(days(8)).toBe(6);
    expect(days(3, true)).toBe(0);
  });
```

In `packages/view/test/help.test.ts`, extend the import to `import { firstTimeGloss, firstTimeWords, readingRow, sentenceCard, shortGloss, wordCard } from "../src/index";`, add `import { newGame, type WordRecord } from "@silver-tongue/core";`, `import { line } from "@silver-tongue/core/testing";`, `import { spacedWithText } from "../src/testing";`, and add:

```ts
describe("reading row", () => {
  const course = fixtureWithText();
  const known: WordRecord = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: 0, lastSeen: 0 };
  const said = line(["你", "w_ni"], ["好", "w_hao"], ["！", null]);

  it("gives the line's reading while any word in it isn't known", () => {
    const state = newGame(course);
    state.words = { w_ni: { ...known } };
    expect(readingRow(course, state, said, 0)).toBe("nǐ hǎo");
  });

  it("drops it once every word is known", () => {
    const state = newGame(course);
    state.words = { w_ni: { ...known }, w_hao: { ...known } };
    expect(readingRow(course, state, said, 0)).toBeUndefined();
  });

  it("has none for words without readings, or when the reading is the words themselves", () => {
    const state = newGame(course);
    expect(readingRow(course, state, line(["茶", "w_cha"]), 0)).toBeUndefined();
    const spaced = spacedWithText();
    expect(readingRow(spaced, newGame(spaced), line(["mi", "w_ni"]), 0)).toBeUndefined();
  });
});
```

In `packages/view/test/notebook.test.ts`, add `bar: 3, label: "known"` to the `toEqual` object for `w_ni`, and add:

```ts
  it("gives each word a memory bar and label, and lists the words first heard in the last day as recent", () => {
    const state = newGame(course);
    const day = 86_400_000;
    state.words = {
      w_ni: rec({ streak: 0, right: 0, firstSeen: T0 + day, first: { line: "你", place: "noodle_shop" } }),
      w_cha: rec({ streak: 2, firstSeen: T0 + 2 * day, first: { line: "茶", place: "noodle_shop" } }),
      w_hao: rec({ streak: 7, right: 7, lapsed: true, firstSeen: 0, first: { line: "好", place: "street" } }),
    };
    const nb = notebookEntries(course, state, t, T0 + 2 * day);
    const byId = Object.fromEntries(nb.groups.flatMap((g) => g.words).map((w) => [w.id, w]));
    expect([byId.w_ni.bar, byId.w_ni.label]).toEqual([0, "new"]);
    expect([byId.w_cha.bar, byId.w_cha.label]).toEqual([2, "met"]);
    expect([byId.w_hao.bar, byId.w_hao.label]).toEqual([5, "shaky"]);
    expect(nb.recent.map((w) => w.id)).toEqual(["w_cha", "w_ni"]); // newest first; 好 is days old
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run packages/view`
Expected: FAIL. `rentInDays` is missing, `readingRow` is not exported, and `bar`/`label`/`recent` are undefined.

- [ ] **Step 3: Implement**

`packages/view/src/hud.ts`: add to `HudValues`:

```ts
  /** Days until rent is taken (at the end of every 7th day): 0 when that's tonight, or when it's late. */
  rentInDays: number;
```

and in `hudValues`, after `rentLate: state.rentLate,`:

```ts
    rentInDays: state.rentLate ? 0 : (7 - (state.day % 7)) % 7,
```

`packages/view/src/help.ts`: change the core import to `import { wordState, type Course, type GameState, type RenderedLine, type Word, type WordId } from "@silver-tongue/core";`, then replace `sentenceCard` with:

```ts
/** Each word's last (plainest) reading, space-separated; "" when none has one. */
function lineReading(course: Course, line: RenderedLine): string {
  return line.tokens.flatMap((tk) => course.words[tk.word]?.readings?.at(-1) ?? []).join(" ");
}

/** What asking about a whole line shows; undefined when the line has no meaning written. */
export function sentenceCard(course: Course, line: RenderedLine): SentenceCard | undefined {
  if (!line.meaning) return undefined;
  return { text: line.text, reading: lineReading(course, line), meaning: line.meaning, clips: line.audio ?? [] };
}

/**
 * The reading shown under a line an NPC says, while any word in it isn't known yet. Undefined once
 * every word is known, when no word has a reading, or when the reading only repeats the words.
 */
export function readingRow(course: Course, state: GameState, line: RenderedLine, now: number): string | undefined {
  if (line.tokens.every((tk) => wordState(state.words[tk.word], now) === "known")) return undefined;
  const reading = lineReading(course, line);
  const words = line.tokens.map((tk) => line.text.slice(tk.start, tk.end)).join(" ");
  return reading && reading !== words ? reading : undefined;
}
```

`packages/view/src/notebook.ts`:
- Change the core import to add `DAY_MS` and `type WordRecord`.
- Add `bar` and `label` to `NotebookWord`, add `recent` to `Notebook`, and build every word through one helper:

```ts
/** What the notebook calls a word: "new" until it is first answered right, then its state. */
export type NotebookLabel = "new" | "met" | "shaky" | "known";
```

In `NotebookWord`, after `state: WordState;`:

```ts
  /** memory: the right-answer streak, 0-5 cells */
  bar: number;
  label: NotebookLabel;
```

In `Notebook`, after `groups: NotebookGroup[];`:

```ts
  /** words first heard within the last day of play, newest first */
  recent: NotebookWord[];
```

In `notebookEntries`, move the object built inside `ids.map(...)` into a helper defined before the loop, and use it:

```ts
  const entry = (id: WordId): NotebookWord => {
    const w = course.words[id];
    const rec: WordRecord = state.words[id];
    const st = wordState(rec, now);
    return {
      id,
      text: w.w,
      readings: w.readings ?? [],
      gloss: w.gloss,
      short: displayGloss(w),
      state: st,
      bar: Math.min(rec.streak, 5),
      label: st === "met" && rec.streak === 0 ? "new" : (st as NotebookLabel),
      clips: w.audio ?? [],
      // Saves from before 0.7.0 may hold the name's mark instead of the name.
      ...(rec.first ? { first: rec.first.line.split(PLAYER_MARK).join(state.player ?? "") } : {}),
    };
  };
```

The group push becomes `groups.push({ place: place || null, title: place ? t(`place-${place}`) : t("notebook-elsewhere"), words: ids.map(entry) });`, and before the `return`:

```ts
  const recent = heard
    .filter((id) => state.words[id].firstSeen >= now - DAY_MS)
    .sort((a, b) => state.words[b].firstSeen - state.words[a].firstSeen)
    .map(entry);
```

Add `recent` to the returned object.

`content/learner/en/ui.ftl`: after the `hud = …` message, add:

```ftl
# The top border (right) and the HUD row under it.
hud-top = Day { $day } · slot { $slot }/{ $slots }
hud-rent = { $days ->
    [0] rent due tonight
    [one] rent due tomorrow
   *[other] rent in { $days } days
}
hud-rent-late = rent late
hud-parcel = parcel
credit = by Bannerless Studio
```

`packages/view/src/text.ts` `UI_KEYS`: after the `hud` entry, add:

```ts
  "hud-top": ["day", "slot", "slots"],
  "hud-rent": ["days"],
  "hud-rent-late": [],
  "hud-parcel": [],
  credit: [],
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run packages/view && npm run typecheck`
Expected: PASS, no type errors. (`vn-web` still compiles; it only reads the fields it knew.)

- [ ] **Step 5: Commit**

```bash
git add packages/view content/learner/en/ui.ftl
git commit -m "view: rent countdown, a reading row that fades, notebook memory bars and recent words"
```

---

### Task 2: The panel layout module and two new colours

**Files:**
- Create: `packages/tui/src/panel.ts`
- Modify: `packages/tui/src/screen.ts` (remove `shorten` and `border`; import `border` from `panel.ts`)
- Modify: `packages/tui/src/terminal.ts` (`Color`)
- Modify: `packages/tui/src/ansi.ts`
- Modify: `packages/tui/src/index.ts`
- Test: `packages/tui/test/panel.test.ts`

**Interfaces:**
- Produces (in `panel.ts`):
  - `const NARROW = 50`
  - `innerWidth(cols: number): number`: the columns inside the frame that panel lines wrap to
  - `interface Panel { title?: string; lines: StyledLine[]; grow?: boolean; drop?: number }`
  - `interface Frame { title: string; right?: string; panels: Panel[]; footer: string; footerRight?: string }`
  - `renderFrame(f: Frame, cols: number, rows: number): StyledLine[]`
  - `border(left, label, right, fill, cols, rightLabel?, keepRight?, labelStyle?): StyledLine` (moved from `screen.ts`)

- [ ] **Step 1: Write the failing test**

`packages/tui/test/panel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderFrame, type Panel } from "../src/panel";
import { plain, type StyledLine } from "../src/terminal";
import { lineWidth } from "../src/width";

const text = (...lines: string[]): StyledLine[] => lines.map((l) => [{ text: l }]);
const log = Array.from({ length: 30 }, (_, i) => `line ${i + 1} 你好`);
const frame = (panels: Panel[], cols: number, rows: number) =>
  renderFrame({ title: "Noodle shop", right: "Day 1 · slot 0/4", panels, footer: "[1-3] reply · [n] notebook" }, cols, rows);
const screen = (lines: StyledLine[]) => lines.map(plain);

describe("panel frames", () => {
  it("fills the terminal exactly, CJK included, at every size", () => {
    for (const [cols, rows] of [[64, 20], [40, 12], [120, 40], [40, 5]]) {
      const f = frame([{ lines: text("¥20") }, { lines: text(...log), grow: true }, { title: "Your reply", lines: text("1) 你好！", "2) 茶") }], cols, rows);
      expect(f.length).toBe(rows);
      for (const l of f) expect(lineWidth(l)).toBe(cols);
    }
  });

  it("has side borders when wide and only rules when narrow", () => {
    const panels: Panel[] = [{ lines: text("¥20") }, { title: "Your reply", lines: text("1) 你好！") }];
    const wide = screen(frame(panels, 64, 8));
    expect(wide[0]).toMatch(/^┌ Noodle shop ─+ Day 1 · slot 0\/4 ┐$/);
    expect(wide[1]).toMatch(/^│ ¥20 +│$/);
    expect(wide).toContainEqual(expect.stringMatching(/^├ Your reply ─+┤$/));
    const narrow = screen(frame(panels, 40, 8));
    expect(narrow[0]).toMatch(/^─ Noodle shop ─+ Day 1 · slot 0\/4 ─$/);
    expect(narrow[1]).toMatch(/^¥20 +$/);
    expect(narrow).toContainEqual(expect.stringMatching(/^─ Your reply ─+$/));
  });

  it("colours panel titles cyan", () => {
    const f = frame([{ lines: text("¥20") }, { title: "Your reply", lines: text("1) 茶") }], 64, 8);
    const rule = f.find((l) => plain(l).includes("Your reply"))!;
    expect(rule.find((s) => s.text.includes("Your reply"))).toMatchObject({ bold: true, color: "cyan" });
  });

  it("gives the growing panel the rows left, showing its last lines", () => {
    const s = screen(frame([{ lines: text("¥20") }, { lines: text(...log), grow: true }, { title: "Your reply", lines: text("1) 你好！") }], 64, 12));
    expect(s.join("\n")).toContain("line 30 你好");
    expect(s.join("\n")).not.toContain("line 1 你好");
    expect(s.at(-2)).toContain("1) 你好！");
  });

  it("drops optional panels when rows run short: the highest drop first, so the log keeps a row", () => {
    const panels: Panel[] = [
      { lines: text("HUD"), drop: 1 },
      { lines: text(...log), grow: true },
      { lines: text("CARD"), drop: 2 },
      { title: "Your reply", lines: text("1", "2", "3", "4", "5", "6") },
    ];
    // hud 1 + log rule 1 + log 1 + card rule 1 + card 1 + reply rule 1 + 6 = 12 rows inside the frame
    let s = screen(frame(panels, 64, 14)).join("\n");
    expect(s).toContain("HUD");
    expect(s).toContain("CARD");
    s = screen(frame(panels, 64, 13)).join("\n");
    expect(s).toContain("HUD");
    expect(s).not.toContain("CARD");
    s = screen(frame(panels, 64, 11)).join("\n");
    expect(s).not.toContain("HUD");
    expect(s).toContain("line 30");
  });

  it("keeps the bottom of a panel taller than the screen, where the choices are", () => {
    const reply = Array.from({ length: 20 }, (_, i) => `${i + 1}) choice`);
    const f = frame([{ lines: text(...log), grow: true }, { title: "Your reply", lines: text(...reply) }], 64, 8);
    const s = screen(f);
    expect(f.length).toBe(8);
    expect(s.at(-2)).toContain("20) choice");
    expect(s.at(-1)).toContain("[1-3] reply");
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run packages/tui/test/panel.test.ts`
Expected: FAIL, "Cannot find module '../src/panel'".

- [ ] **Step 3: Implement**

`packages/tui/src/terminal.ts`: `export type Color = "cyan" | "yellow" | "green" | "red" | "magenta" | "blue" | "white";`

`packages/tui/src/ansi.ts`: `const COLORS: Record<NonNullable<Span["color"]>, number> = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37 };`

`packages/tui/src/panel.ts`:

```ts
import type { Span, StyledLine } from "./terminal";
import { fitLine, strWidth, wrapLine } from "./width";

/** Below this many columns (a phone held upright) panels lose their side borders: rules only. */
export const NARROW = 50;

/** The columns inside the frame, that panel lines are wrapped to. */
export const innerWidth = (cols: number): number => Math.max(1, cols < NARROW ? cols : cols - 4);

export interface Panel {
  /** on the rule above the panel; the first panel has no rule, so its title isn't shown */
  title?: string;
  lines: StyledLine[];
  /** takes the rows the other panels leave, showing its last lines (the log); one panel at most */
  grow?: boolean;
  /** may be left out when rows run short, the highest number first */
  drop?: number;
}

export interface Frame {
  title: string;
  /** right of the top border, e.g. "Day 1 · slot 0/4" */
  right?: string;
  panels: Panel[];
  /** key hints, left of the bottom border */
  footer: string;
  /** right of the bottom border, e.g. the version; the key hints give way to it */
  footerRight?: string;
}

/** A label shortened to `width`: whole " · " parts dropped from the end first, then cut. */
function shorten(label: string, width: number): string {
  let parts = label.split(" · ");
  while (parts.length > 1 && strWidth(parts.join(" · ")) > width) parts = parts.slice(0, -1);
  const text = parts.join(" · ");
  return strWidth(text) <= width ? text : fitLine([{ text }], width).map((sp) => sp.text).join("");
}

/** keepRight: the right label stays whole and the left one gives way (else the right is cut). */
export function border(
  left: string,
  label: string,
  right: string,
  fill: string,
  cols: number,
  rightLabel = "",
  keepRight = false,
  labelStyle: Omit<Span, "text"> = { bold: true },
): StyledLine {
  const inner = cols - 2;
  const r = rightLabel ? ` ${rightLabel} ` : "";
  const l = !label ? "" : keepRight ? ` ${shorten(label, Math.max(0, inner - strWidth(r) - 2))} ` : ` ${label} `;
  const gap = Math.max(0, inner - strWidth(l) - strWidth(r));
  return fitLine(
    [
      { text: left, dim: true },
      { ...labelStyle, text: l },
      { text: fill.repeat(gap), dim: true },
      { text: r },
      { text: right, dim: true },
    ],
    cols,
  );
}

const TITLE: Omit<Span, "text"> = { bold: true, color: "cyan" };

/**
 * A screen: the title (and `right`) on the top border, the panels one under another, joined by
 * rules that carry their titles, and the key hints on the bottom border. Rows go to the fixed panels
 * first; the growing one (the log) gets the rest. When even one log row doesn't fit, the optional
 * panels are dropped, the highest `drop` first. A frame still too tall keeps its bottom rows.
 */
export function renderFrame(f: Frame, cols: number, rows: number): StyledLine[] {
  const narrow = cols < NARROW;
  const inner = innerWidth(cols);
  const avail = Math.max(1, rows - 2);
  const side = (l: StyledLine): StyledLine =>
    narrow ? fitLine(l, inner) : [{ text: "│ ", dim: true }, ...fitLine(l, inner), { text: " │", dim: true }];
  const rule = (title = "") => (narrow ? border("─", title, "─", "─", cols, "", false, TITLE) : border("├", title, "┤", "─", cols, "", false, TITLE));

  let panels = f.panels.map((p) => ({ ...p, rows: p.lines.flatMap((l) => wrapLine(l, inner)) }));
  const need = () => panels.reduce((n, p, i) => n + (i > 0 ? 1 : 0) + (p.grow ? 1 : p.rows.length), 0);
  while (need() > avail && panels.some((p) => p.drop !== undefined)) {
    const top = Math.max(...panels.map((p) => p.drop ?? -Infinity));
    const i = panels.findIndex((p) => p.drop === top);
    panels = panels.filter((_, j) => j !== i);
  }
  const growing = panels.some((p) => p.grow);
  const growRows = Math.max(0, avail - (need() - (growing ? 1 : 0)));
  if (growing && growRows === 0) panels = panels.filter((p) => !p.grow);

  const body: StyledLine[] = [];
  panels.forEach((p, i) => {
    if (i > 0) body.push(rule(p.title));
    if (!p.grow) return void body.push(...p.rows.map(side));
    const shown = p.rows.slice(-growRows); // growRows > 0 here: slice(-0) would be every row
    body.push(...Array(growRows - shown.length).fill(side([])), ...shown.map(side));
  });
  const shown = body.slice(-avail);
  shown.push(...Array(avail - shown.length).fill(side([])));
  return [
    narrow ? border("─", f.title, "─", "─", cols, f.right) : border("┌", f.title, "┐", "─", cols, f.right),
    ...shown,
    // The bottom right says whether sound works; the key hints give way to it.
    narrow ? border("─", f.footer, "─", "─", cols, f.footerRight, true) : border("└", f.footer, "┘", "─", cols, f.footerRight, true),
  ];
}
```

`packages/tui/src/screen.ts`: delete `shorten` and `border` (now in `panel.ts`) and add `import { border } from "./panel";` so `renderScreen` keeps working until Task 3 removes it. Remove `fitLine` and `strWidth` from its `width` import if they become unused (`wrapItems` still uses `strWidth`, and `renderScreen` still uses `fitLine`).

`packages/tui/src/index.ts`: add `export * from "./panel";`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run packages/tui packages/tui-node && npm run typecheck`
Expected: PASS. The app still draws through `renderScreen`, so its tests are unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/tui
git commit -m "tui: a panel layout for frames, with rules and a narrow mode; blue and white"
```

---

### Task 3: Play screens on panels (header, HUD, log with readings, word card, reply panel, credit)

**Files:**
- Modify: `packages/tui/src/app.ts`
- Modify: `packages/tui/src/screen.ts` (delete `ScreenModel` and `renderScreen`; `lineSpans` colours first-time words)
- Modify: `content/learner/en/ui.ftl` (remove `hud`; `reply-title = Your reply`)
- Modify: `packages/view/src/text.ts` (remove `hud` from `UI_KEYS`)
- Test: `packages/tui/test/app.test.ts`, `packages/view/test/text.test.ts`

**Interfaces:**
- Consumes: `renderFrame`, `Panel`, `innerWidth`, `NARROW` (Task 2); `readingRow`, `HudValues.rentInDays`, the `hud-*` and `credit` keys (Task 1).
- Produces: `app.ts` draws every non-notebook screen as `[hud (drop 1), log (grow), card? (drop 2), reply]`. The notebook screen keeps its old content, drawn through `renderFrame`, until Task 4.

- [ ] **Step 1: Write the failing tests**

Add to `describe("tui app", …)` in `packages/tui/test/app.test.ts`:

```ts
  it("puts the day in the top border and money, rent and rank in the HUD row", () => {
    const { term } = setup();
    const s = term.screen();
    expect(s[0]).toMatch(/^┌ The street ─+ Day 1 · slot 0\/4 ┐$/);
    expect(s[1]).toContain("¥20 · rent in 6 days · Speaks: Pidgin");
  });

  it("shows a line's reading under it while its words are new, and not once they're known", () => {
    const { term } = setup();
    term.press("1", "1");
    expect(term.screen().join("\n")).toMatch(/Cook: 你好！ *│\n│ +nǐ hǎo/);
    const known = { right: 3, wrong: 0, streak: 3, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0 };
    const again = setup((s) => (s.words = { w_ni: { ...known }, w_hao: { ...known } }));
    again.term.press("1", "1");
    expect(again.term.screen().join("\n")).not.toContain("nǐ hǎo");
  });

  it("opens a looked-up word in a card above the replies, closed by a reply or esc", () => {
    const { term, core } = setup();
    term.press("1", "1", "w", "1");
    let s = term.screen();
    const card = s.findIndex((l) => l.includes("你 nǐ — you"));
    expect(card).toBeGreaterThan(0);
    expect(card).toBeLessThan(s.findIndex((l) => l.includes("Your reply")));
    term.press("escape"); // back from the word list; the card stays
    expect(term.screen().join("\n")).toContain("你 nǐ — you");
    term.press("escape"); // closes the card
    expect(term.screen().join("\n")).not.toContain("你 nǐ — you");
    term.press("w", "1", "escape", rightKey(core)); // a reply closes it too
    expect(term.screen().join("\n")).not.toContain("你 nǐ — you");
  });

  it("gives up the word card, then the HUD, before the log's last row on a short screen", () => {
    const { term } = setup();
    term.press("1", "1", "w", "1", "escape");
    term.resize(40, 8);
    const f = term.frames.at(-1)!;
    expect(f.length).toBe(8);
    for (const l of f) expect(lineWidth(l)).toBe(40);
    const s = term.screen().join("\n");
    expect(s).not.toContain("你 nǐ — you");
    expect(s).toMatch(/1\) /);
  });

  it("draws every screen inside the terminal at phone, short, laptop and wide sizes", () => {
    for (const [cols, rows] of [[40, 12], [40, 8], [80, 24], [120, 40]]) {
      const { term } = setup();
      term.resize(cols, rows);
      const check = () => {
        const f = term.frames.at(-1)!;
        expect(f.length).toBe(rows);
        for (const l of f) expect(lineWidth(l)).toBe(cols);
        expect(term.screen().at(-1)).toContain("[");
      };
      check(); // explore
      term.press("1", "1");
      check(); // a scene: pick a reply
      term.press("w");
      check(); // help: the word list
      term.press("1");
      check(); // a word card
      term.press("escape");
      check();
      term.press("n");
      check(); // the notebook
      term.press("escape");
    }
  });

  it("credits Bannerless Studio next to the version when there is room", () => {
    const course = fixtureWithText();
    const core = createCore(course, newGame(course), { now: () => T0, rng: mulberry32(1) });
    const term = new FakeTerminal(120, 20);
    startApp({ course, core, term, now: () => T0, quit: () => {}, version: "0.16.1" });
    expect(term.screen().at(-1)).toMatch(/no audio · Silver Tongue v0\.16\.1 · by Bannerless Studio ┘$/);
  });
```

Update these existing assertions, which pin the old single frame:

- "opens a new game with the story, wrapped to the screen" (40 columns is narrow now, with no side borders): `toMatch(/An old man on a bench is watching you\s*\nwith open curiosity\./)`.
- "starts on the street with a menu and a HUD": replace `"Day 1 · slot 0/4 · ¥20"` with two checks, `"Day 1 · slot 0/4"` and `"¥20 · rent in 6 days"`.
- "heads the replies…": `"Your reply:"` becomes `"Your reply"` (both places).
- "shows a scene's slot cost only in the HUD…": `"¥20 · rent due"` becomes `"¥20 · rent late"`.
- "marks the status line while a parcel is carried": `/Day 1 .*· parcel/` becomes `/¥20 · .*· parcel/`.
- "keeps the NPC's request on screen when the prompt nearly fills it": replace the comment and `rows` with:
  ```ts
    // frame 2 + HUD 1 + log rule 1 + the NPC's line, its reading and its first-time gloss 3
    // + reply rule 1 + options
    const rows = 2 + 1 + 1 + 3 + 1 + core.state.run!.options.length;
  ```
- "shows the game's version in the bottom border": the 46-column line is narrow now: `/^─ \[1-3\] choose · \[n\] notebook ─* no audio ─$/`.
- "lists r at phone width while picking…": `/^─ \[1-3\] reply · \[w\] help · \[r\] again ─*─$/`.
- "opens the notebook with n…": `"Your reply:"` becomes `"Your reply"` (both places).

`packages/view/test/text.test.ts` "reports missing messages and unknown variables": use `const broken = "hud-top = Day { $dya }\n";` and expect `'learner text "hud-top": Unknown variable: $dya'`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run packages/tui/test/app.test.ts packages/view/test/text.test.ts`
Expected: FAIL. The new tests fail (no HUD row, no reading row, no card panel, no credit), and so do the updated old ones.

- [ ] **Step 3: Implement**

`content/learner/en/ui.ftl`: delete the whole `hud = …` message (8 lines) and change `reply-title = Your reply:` to `reply-title = Your reply`. `packages/view/src/text.ts`: delete the `hud: [...]` entry from `UI_KEYS`.

`packages/tui/src/screen.ts`: delete `ScreenModel`, `renderScreen` and the `border` import. First-time words turn cyan as well as underlined:

```ts
    const text = line.text.slice(t.start, t.end);
    out.push(fresh.has(t.word) ? { text, underline: true, color: "cyan" } : { text });
```

`packages/tui/src/app.ts`:

1. Imports:
   ```ts
   import { lineSpans, wrapItems } from "./screen";
   import { innerWidth, NARROW, renderFrame, type Panel } from "./panel";
   ```
   and add `readingRow` and `type HudValues` to the `@silver-tongue/view` import.

2. State, next to `lastHelp`:
   ```ts
   let card: StyledLine | null = null; // the word or sentence last looked up, shown above the replies
   ```

3. Replace `say` users with one helper, after `say`:
   ```ts
   /** An NPC's line, then its reading while any word in it isn't known yet, lined up under the words. */
   const sayLine = (npc: string, line: RenderedLine, fresh: Set<WordId>, suffix = "") => {
     push(say(npc, line, fresh, suffix));
     const reading = readingRow(course, core.state, line, opts.now());
     if (reading) push([{ text: " ".repeat(strWidth(`${npcName(npc)}${suffix}: `)) + reading, color: "yellow", dim: true }]);
   };
   ```
   In `apply`: `lineSpoken` calls `sayLine(e.npc, e.line, fresh)` instead of `push(say(...))`; `npcReacted` calls `sayLine(e.npc, e.line, fresh)`; `lineRephrased` calls `sayLine(e.npc, e.line, fresh, ` ${t("rephrased")}`)`. `sceneStarted` and `sceneEnded` each also set `card = null;`.

4. Replace `prompt(width)` with `replyPanel(width)`. It returns the same lines, without the dim title line at the top, which becomes the panel title:
   ```ts
   /** The panel at the bottom: what the player can do now. `width` is the room inside the frame. */
   function replyPanel(width: number): Panel {
     if (mode === "name") {
       return { lines: [[{ text: t("name-prompt"), bold: true }], [{ text: "> " }, { text: nameInput, bold: true }, { text: "_", dim: true }]] };
     }
     if (SETTINGS_MODES.includes(mode)) {
       const title = mode === "settings" ? "settings-title" : mode === "settings-course" ? "settings-pick-course" : "settings-pick-reading";
       return { title: t(title), lines: settingsChoices().map((r, i) => [{ text: `${i + 1}) ${r.label}` }]) };
     }
     if (mode === "explore") {
       // Scenes here that wait only for money: shown, not offered, so an empty shop says why.
       const waiting: StyledLine[] = waitingForMoney(course, core.state, t).map((text) => [{ text, dim: true }]);
       return {
         title: t("menu-title"),
         lines: [
           ...waiting,
           ...menu().map((m, i) => [
             m.disabled ? { text: `${i + 1}) ${m.label} — ${m.disabled}`, dim: true } : { text: `${i + 1}) ${m.label}` },
           ]),
         ],
       };
     }
     if (mode === "help") {
       const items = helpWords().map((w, i) => ({ ...w, label: `${i + 1}) ${w.text}` }));
       const said = items.filter((w) => !w.inReplies).map((w) => w.label);
       const inReplies = items.filter((w) => w.inReplies).map((w) => w.label);
       const sentence: StyledLine[] = lastLine?.meaning ? [[{ text: `s) ${t("help-sentence")}` }]] : [];
       return {
         title: t("help-title"),
         lines: [
           ...wrapItems(said, width),
           ...sentence,
           ...(inReplies.length ? [[{ text: t("help-in-replies"), dim: true }], ...wrapItems(inReplies, width)] : []),
         ],
       };
     }
     if (replyMode === "pick")
       return {
         title: t("reply-title"),
         lines: pickOptions.map((o, i) => [
           { text: `${i + 1}) ` },
           ...lineSpans(o, new Set()),
           // Once every word in a reply is known, its meaning is no longer news.
           ...(o.meaning && replyNeedsGloss(o) ? [{ text: `  — ${o.meaning}`, dim: true }] : []),
         ]),
       };
     return {
       title: t("reply-title"),
       lines: [
         [{ text: t("tiles-title", { keys: keyRange(tiles.length) }), dim: true }],
         ...wrapItems(tiles.map((x, i) => `[${i + 1}]${x}`), width, " "),
         [{ text: `${t("tiles-answer")} `, dim: true }, { text: joinTiles(course, tileInput.map((i) => tiles[i])), bold: true }],
       ],
     };
   }
   ```

5. The HUD row, after `replyPanel`:
   ```ts
   /** Money, rent (yellow the night it's due, red once late), how well you speak, and the parcel. */
   function hudRow(h: HudValues): StyledLine {
     const sep = { text: " · ", dim: true };
     const rent = h.rentLate
       ? { text: t("hud-rent-late"), color: "red" as const }
       : { text: t("hud-rent", { days: h.rentInDays }), ...(h.rentInDays === 0 ? { color: "yellow" as const } : {}) };
     return [
       { text: `${h.currency}${h.wallet}`, bold: true },
       sep,
       rent,
       sep,
       { text: t("notebook-rank", { rank: h.rankLabel }) },
       ...(h.parcel ? [sep, { text: t("hud-parcel"), color: "cyan" as const }] : []),
     ];
   }
   ```

6. `footerRight` steps down through four choices. Replace its last four lines (from `const full = …`) with:
   ```ts
     const choices = [[sound, `Silver Tongue v${v}`, t("credit")], [sound, `Silver Tongue v${v}`], [sound, `v${v}`], [sound]];
     return choices.map((parts) => parts.filter(Boolean).join(" · ")).find((c) => strWidth(c) <= room) ?? sound;
   ```
   Update its doc comment: "…then the version and the credit, stepped down (credit, then "Silver Tongue", then all of it) when the key hints on the left leave no room."

7. `render()`: replace the `hud` string with the header, and draw through `renderFrame`:
   ```ts
     const h = hudValues(course, s, t, opts.now());
     const top = { title: t(`place-${s.place}`), right: t("hud-top", { day: h.day, slot: h.slot, slots: h.slots }) };
     if (mode === "notebook") {
       const lines = notebookLines(course, s, t, opts.now()).flatMap((l) => wrapLine(l, innerWidth(cols)));
       const bodyRows = Math.max(1, rows - 2);
       notebookTop = Math.max(0, Math.min(notebookTop, lines.length - bodyRows));
       const page = lines.slice(notebookTop, notebookTop + bodyRows);
       const footer = t("keys-notebook");
       term.write(renderFrame({ ...top, panels: [{ lines: page }], footer, footerRight: footerRight(footer, cols) }, cols, rows));
       return;
     }
   ```
   Keep the `footerId`/`keys`/`footer` lines as they are, then:
   ```ts
     const panels: Panel[] = [
       { lines: [hudRow(h)], drop: 1 },
       { lines: log, grow: true },
       ...(card && mode !== "explore" ? [{ lines: [card], drop: 2 }] : []),
       replyPanel(innerWidth(cols)),
     ];
     const left = cols < NARROW ? 0 : 2; // where a line's text starts: after "│ " when wide
     term.write(
       renderFrame({ ...top, panels, footer, footerRight: footerRight(footer, cols) }, cols, rows),
       // Typing a name: the cursor sits after the text, where a phone keyboard shows what's being composed.
       mode === "name" ? { row: rows - 2, col: Math.min(cols - 1 - left, left + 2 + strWidth(nameInput)) } : undefined,
     );
   ```

8. `press()`: a lookup opens the card instead of logging. In the help branch, replace `push([...card line...])` for a word with:
   ```ts
           card = [
             { text: wc.text, bold: true },
             ...(wc.readings.length ? [{ text: ` ${wc.readings.join(" ")}`, color: "yellow" as const }] : []),
             { text: ` — ${wc.gloss}` },
           ];
   ```
   (rename the local `const card = wordCard(...)` to `const wc = wordCard(...)` so it doesn't shadow the state), and replace the sentence's `push([...])` with:
   ```ts
           card = [
             { text: sentence.text, bold: true },
             ...(sentence.reading ? [{ text: ` ${sentence.reading}`, color: "yellow" as const }] : []),
             { text: ` — ${sentence.meaning}` },
           ];
   ``` After the `help` branch, before `} else if (key.name === "w") {`, add:
   ```ts
       } else if (key.name === "escape") {
         card = null;
   ```
   Set `card = null;` in the pick branch before `echo(...)`, and in the tiles `return` branch before `echo(...)`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test && npm run typecheck`
Expected: PASS, with 453 + 6 (Task 3) + 5 (Tasks 1-2) tests or more. If another `app.test.ts` assertion fails, change it only if it pins layout (border characters, `"Your reply:"`, HUD text, row positions). A failing behaviour assertion (what a key does, what is said or saved) is a bug in this task: fix the code.

- [ ] **Step 5: Commit**

```bash
git add packages/tui packages/view content/learner/en/ui.ftl
git commit -m "tui: play screens as panels, with a HUD row, fading readings, a word card and the credit"
```

---

### Task 4: The two-column notebook

**Files:**
- Modify: `packages/tui/src/notebook.ts` (replace `notebookLines`)
- Modify: `packages/tui/src/app.ts` (notebook state, render and keys)
- Modify: `content/learner/en/ui.ftl`, `packages/view/src/text.ts`
- Test: `packages/tui/test/notebook.test.ts` (rewrite), `packages/tui/test/app.test.ts`

**Interfaces:**
- Consumes: `Notebook.recent`, `NotebookWord.bar/label` (Task 1); `innerWidth`, `NARROW`, `renderFrame` (Task 2).
- Produces (in `notebook.ts`):
  - `interface NotebookView { tab: "words" | "notes"; group: number; word: number; open: boolean; top: number }`
  - `notebookGroups(nb: Notebook, t: Text): { title: string; words: NotebookWord[] }[]`: Recent first (when it has words), then the place groups
  - `notebookHead(nb: Notebook, t: Text, tab: NotebookView["tab"]): StyledLine[]`: the tab line and the progress lines
  - `notebookBody(nb: Notebook, t: Text, v: NotebookView, cols: number, height: number): { lines: StyledLine[]; top: number }`: exactly `height` lines, each at most `innerWidth(cols)` wide

- [ ] **Step 1: Strings**

`content/learner/en/ui.ftl`: replace `keys-notebook = [↑↓] scroll · [esc] back` with the lines below. `[esc] back` comes first so a narrow footer keeps it.

```ftl
keys-notebook = [esc] back · [1-2] words/notes · [↑↓] word · [←→] group · [enter] more · [p] play
notebook-title = Notebook
notebook-words = Words
notebook-recent = Recent
notebook-notes-empty = No notes yet. Ask around; someone will explain things.
notebook-label-new = new
notebook-label-met = met
notebook-label-shaky = shaky
notebook-label-known = known
```

`UI_KEYS`: add `"notebook-title": [], "notebook-words": [], "notebook-recent": [], "notebook-notes-empty": [], "notebook-label-new": [], "notebook-label-met": [], "notebook-label-shaky": [], "notebook-label-known": [],`.

- [ ] **Step 2: Write the failing tests**

Replace `packages/tui/test/notebook.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { newGame, PLAYER_MARK, type WordRecord } from "@silver-tongue/core";
import { makeText, notebookEntries } from "@silver-tongue/view";
import { notebookBody, notebookGroups, notebookHead, type NotebookView } from "../src/notebook";
import { innerWidth } from "../src/panel";
import { plain } from "../src/terminal";
import { lineWidth } from "../src/width";
import { fixtureWithText, spacedWithText } from "./fake-terminal";

const T0 = 1_000_000;
// A day and a half on: nothing heard at T0 is recent, and a streak-3 word (2 days) is still known.
const LATER = T0 + 1.5 * 86_400_000;
const rec = (patch: Partial<WordRecord>): WordRecord => ({
  right: 1, wrong: 0, streak: 1, helps: 0, lapsed: false, firstSeen: T0, lastSeen: T0, ...patch,
});
const view = (patch: Partial<NotebookView> = {}): NotebookView => ({ tab: "words", group: 0, word: 0, open: false, top: 0, ...patch });

describe("notebook", () => {
  const course = fixtureWithText();
  course.notes = [{ id: "hao", trigger: { word: "w_hao" } }];
  const t = makeText(course.learnerFtl, "en");
  const state = newGame(course);
  state.words = {
    w_ni: rec({ streak: 3, right: 3, first: { line: "你好！", place: "noodle_shop" } }),
    w_cha: rec({ lapsed: true, first: { line: "茶。", place: "noodle_shop" } }),
    x_bei: rec({ first: { line: "三杯茶。", place: "street" } }),
  };
  state.notes.read = ["hao"];
  const body = (v: Partial<NotebookView>, cols = 80, now = LATER, height = 10) =>
    notebookBody(notebookEntries(course, state, t, now), t, view(v), cols, height);
  const text = (v: Partial<NotebookView>, cols = 80, now = LATER) => body(v, cols, now).lines.map(plain).join("\n");

  it("heads the page with the tabs and progress", () => {
    const head = notebookHead(notebookEntries(course, state, t, LATER), t, "words").map(plain);
    expect(head[0]).toMatch(/1\) Words +2\) Notes/);
    expect(head[1]).toBe("Stage 1: 1 of 12 words known · 3 heard");
  });

  it("lists places on the left and the chosen place's words, bars and labels on the right", () => {
    const s = text({ group: 1 });
    expect(s).toMatch(/▸ Noodle shop \(2\)/);
    expect(s).toMatch(/▸ 你 nǐ +■■■□□ known/);
    expect(s).toMatch(/ 茶 +■□□□□ shaky/);
    expect(s).toContain("you");
    expect(s).not.toContain("杯");
  });

  it("puts recent words first, then the places", () => {
    const groups = notebookGroups(notebookEntries(course, state, t, T0), t);
    expect(groups.map((g) => g.title)).toEqual(["Recent", "The street", "Noodle shop"]);
    expect(notebookGroups(notebookEntries(course, state, t, LATER), t).map((g) => g.title)).toEqual(["The street", "Noodle shop"]);
  });

  it("opens the chosen word to show the line it was first heard in, with the player's name", () => {
    const named = { ...state, player: "Jamil", words: { ...state.words, x_bei: rec({ first: { line: `是${PLAYER_MARK}。`, place: "street" } }) } };
    const nb = notebookEntries(course, named, t, LATER);
    expect(notebookBody(nb, t, view({ open: true }), 80, 10).lines.map(plain).join("\n")).toContain("是Jamil。");
    expect(notebookBody(nb, t, view(), 80, 10).lines.map(plain).join("\n")).not.toContain("是Jamil。");
  });

  it("scrolls the list so the chosen word shows", () => {
    const s = body({ group: 1, word: 1 }, 80, LATER, 2).lines.map(plain).join("\n");
    expect(s).toContain("茶");
  });

  it("is one column at phone width, the place named with arrows", () => {
    const lines = body({ group: 0 }, 40).lines;
    expect(plain(lines[0])).toMatch(/^ +The street \(1\) ▸/);
    for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(innerWidth(40));
  });

  it("clamps a group that no longer exists", () => {
    expect(text({ group: 9 })).toMatch(/▸ Noodle shop \(2\)/);
  });

  it("shows the notes read so far on the Notes tab, or says there are none", () => {
    expect(text({ tab: "notes" })).toMatch(/好 means good\nOn its own, 好 agrees\./);
    const none = newGame(course);
    const nb = notebookEntries(course, none, t, LATER);
    expect(notebookBody(nb, t, view({ tab: "notes" }), 80, 5).lines.map(plain).join("\n")).toContain("No notes yet.");
  });

  it("says so when nothing has been heard yet", () => {
    const nb = notebookEntries(course, newGame(course), t, LATER);
    expect(notebookBody(nb, t, view(), 80, 5).lines.map(plain).join("\n")).toContain("Nothing yet.");
  });

  it("is always exactly the height asked for, and within the frame", () => {
    for (const cols of [40, 64, 120])
      for (const v of [view(), view({ tab: "notes" }), view({ group: 1, open: true })]) {
        const { lines } = notebookBody(notebookEntries(course, state, t, T0), t, v, cols, 7);
        expect(lines.length).toBe(7);
        for (const l of lines) expect(lineWidth(l)).toBeLessThanOrEqual(innerWidth(cols));
      }
  });

  it("shows every reading of a word", () => {
    const spaced = spacedWithText();
    const s = newGame(spaced);
    s.words = { w_ni: rec({ first: { line: "mi bon!", place: "noodle_shop" } }) };
    const nb = notebookEntries(spaced, s, t, LATER);
    expect(notebookBody(nb, t, view(), 80, 5).lines.map(plain).join("\n")).toContain("mi mí mi");
  });
});
```

In `packages/tui/test/app.test.ts`, replace "opens the notebook with n, scrolls it, and goes back where it was" with:

```ts
  it("opens the notebook with n: words by group, notes, and back where it was", () => {
    const { term, core } = setup();
    term.press("1", "1");
    term.press(rightKey(core));
    term.press("n");
    let s = term.screen();
    expect(s[0]).toMatch(/Notebook ─+ Speaks: Pidgin/);
    expect(s.join("\n")).toContain("Stage 1: 0 of 12 words known");
    expect(s.join("\n")).toMatch(/▸ Recent \(\d+\)/);
    expect(s.at(-1)).toContain("[esc] back");
    // the chosen word: the right-hand column's row that starts with ▸
    const chosen = () => term.screen().map((l) => l.split(" │ ")[1] ?? "").find((r) => r.startsWith("▸ "));
    const first = chosen();
    expect(first).toBeDefined();
    term.press("down");
    expect(chosen()).not.toBe(first);
    term.press("2");
    expect(term.screen().join("\n")).toContain("No notes yet.");
    term.press("escape");
    s = term.screen();
    expect(s.join("\n")).toContain("Your reply");
    term.press("n", "n");
    expect(term.screen().join("\n")).toContain("Your reply");
  });
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run packages/tui/test/notebook.test.ts packages/tui/test/app.test.ts`
Expected: FAIL. `notebookBody`, `notebookGroups` and `notebookHead` aren't exported, and the app test finds no "Recent".

- [ ] **Step 4: Implement `notebook.ts`**

Replace `packages/tui/src/notebook.ts` with:

```ts
import type { Notebook, NotebookLabel, NotebookWord, Text } from "@silver-tongue/view";
import { innerWidth, NARROW } from "./panel";
import type { Span, StyledLine } from "./terminal";
import { fitLine, strWidth, wrapLine } from "./width";

export interface NotebookView {
  tab: "words" | "notes";
  /** the chosen group in notebookGroups */
  group: number;
  /** the chosen word in that group */
  word: number;
  /** the chosen word shows the line it was first heard in */
  open: boolean;
  /** Notes tab: the first line on screen */
  top: number;
}

/** Width of the group list on the left, when there's room for two columns. */
const LEFT = 18;
const BAR = 5;
const LABELS: NotebookLabel[] = ["new", "met", "shaky", "known"];
const LABEL_STYLE: Record<NotebookLabel, Omit<Span, "text">> = { new: { color: "cyan" }, met: {}, shaky: { color: "yellow" }, known: { color: "green" } };

/** The Words tab's groups: Recent first when it has anything, then each place in world order. */
export function notebookGroups(nb: Notebook, t: Text): { title: string; words: NotebookWord[] }[] {
  return [...(nb.recent.length ? [{ title: t("notebook-recent"), words: nb.recent }] : []), ...nb.groups];
}

/** The tab line, then progress on each stage's word list. */
export function notebookHead(nb: Notebook, t: Text, tab: NotebookView["tab"]): StyledLine[] {
  const tabSpan = (n: number, id: string, on: boolean): Span =>
    on ? { text: `${n}) ${t(id)}`, bold: true, color: "cyan" } : { text: `${n}) ${t(id)}`, dim: true };
  return [
    [tabSpan(1, "notebook-words", tab === "words"), { text: "   " }, tabSpan(2, "notebook-notes", tab === "notes")],
    ...nb.progress.map((text) => [{ text, dim: true }]),
  ];
}

/** A word's rows: text, readings, bar and label; its short gloss; and, opened, its first line. */
function wordRows(w: NotebookWord, chosen: boolean, open: boolean, width: number, t: Text): StyledLine[] {
  const labelWidth = Math.max(...LABELS.map((l) => strWidth(t(`notebook-label-${l}`))));
  const label = t(`notebook-label-${w.label}`);
  const tail: StyledLine = [
    { text: " " },
    { text: "■".repeat(w.bar), ...LABEL_STYLE[w.label] },
    { text: "□".repeat(BAR - w.bar), dim: true },
    { text: ` ${label}${" ".repeat(labelWidth - strWidth(label))}`, ...LABEL_STYLE[w.label] },
  ];
  const tailWidth = 1 + BAR + 1 + labelWidth;
  const head: StyledLine = [
    { text: chosen ? "▸ " : "  ", bold: true },
    { text: w.text, bold: true },
    ...(w.readings.length ? [{ text: ` ${w.readings.join(" ")}`, color: "yellow" as const }] : []),
  ];
  const rows: StyledLine[] =
    width > tailWidth + 6 ? [[...fitLine(head, width - tailWidth), ...tail]] : [fitLine(head, width), fitLine(tail, width)];
  rows.push(fitLine([{ text: "    " }, { text: w.short, dim: true }], width));
  if (open && w.first !== undefined) rows.push(...wrapLine([{ text: "    " }, { text: w.first, dim: true }], width));
  return rows;
}

const pad = (lines: StyledLine[], height: number): StyledLine[] => [...lines, ...Array(Math.max(0, height - lines.length)).fill([])].slice(0, height);

/**
 * The notebook below its head, exactly `height` lines. Words: the groups on the left and the chosen
 * group's words on the right, scrolled so the chosen word shows; one column at phone width. Notes:
 * the notes read so far, from line `v.top` (clamped; the top used is returned).
 */
export function notebookBody(nb: Notebook, t: Text, v: NotebookView, cols: number, height: number): { lines: StyledLine[]; top: number } {
  const inner = innerWidth(cols);
  if (v.tab === "notes") {
    const all: StyledLine[] = nb.notes.length
      ? nb.notes.flatMap((n) => [...wrapLine([{ text: n.title, bold: true }], inner), ...wrapLine([{ text: n.text }], inner), []])
      : [[{ text: t("notebook-notes-empty"), dim: true }]];
    const top = Math.max(0, Math.min(v.top, all.length - height));
    return { lines: pad(all.slice(top, top + height), height), top };
  }
  if (nb.empty) return { lines: pad([[{ text: t("notebook-empty"), dim: true }]], height), top: 0 };
  const groups = notebookGroups(nb, t);
  const g = Math.max(0, Math.min(v.group, groups.length - 1));
  const narrow = cols < NARROW;
  const rightWidth = narrow ? inner : inner - LEFT - 3;
  const words = groups[g].words;
  const chosen = Math.max(0, Math.min(v.word, words.length - 1));
  const blocks = words.map((w, i) => wordRows(w, i === chosen, v.open && i === chosen, rightWidth, t));
  const listHeight = narrow ? height - 1 : height;
  const start = blocks.slice(0, chosen).reduce((n, b) => n + b.length, 0);
  const end = start + blocks[chosen].length;
  const top = Math.max(0, Math.min(start, end - listHeight));
  const right = blocks.flat().slice(top, top + listHeight);
  const name = `${groups[g].title} (${groups[g].words.length})`;
  if (narrow) {
    const nav: StyledLine = [
      { text: g > 0 ? "◂ " : "  ", dim: true },
      { text: name, bold: true, color: "cyan" },
      { text: g < groups.length - 1 ? " ▸" : "", dim: true },
    ];
    return { lines: pad([fitLine(nav, inner), ...right], height), top: 0 };
  }
  const leftTop = Math.max(0, g - height + 1);
  const left = groups.map((gr, i) =>
    fitLine([{ text: i === g ? "▸ " : "  ", bold: true }, { text: `${gr.title} (${gr.words.length})`, ...(i === g ? { bold: true, color: "cyan" as const } : {}) }], LEFT),
  );
  const lines = Array.from({ length: height }, (_, r): StyledLine => [
    ...(left[leftTop + r] ?? fitLine([], LEFT)),
    { text: " │ ", dim: true },
    ...(right[r] ?? []),
  ]);
  return { lines, top: 0 };
}
```

- [ ] **Step 5: Wire it into `app.ts`**

- Import: replace `import { notebookLines } from "./notebook";` with `import { notebookBody, notebookGroups, notebookHead, type NotebookView } from "./notebook";`, and add `notebookEntries` to the `@silver-tongue/view` import.
- State: replace `let notebookTop = 0; // first notebook line on screen` with
  ```ts
  let nbView: NotebookView = { tab: "words", group: 0, word: 0, open: false, top: 0 };
  ```
- `render()`: replace the whole `if (mode === "notebook") { … }` block with:
  ```ts
    if (mode === "notebook") {
      const book = notebookEntries(course, s, t, opts.now());
      const head = notebookHead(book, t, nbView.tab);
      const headRows = head.flatMap((l) => wrapLine(l, innerWidth(cols))).length;
      const height = Math.max(1, rows - 3 - headRows); // top border, the rule under the head, bottom border
      const body = notebookBody(book, t, nbView, cols, height);
      nbView = { ...nbView, top: body.top };
      const footer = t("keys-notebook");
      const frame = { title: t("notebook-title"), right: book.rankLabel, panels: [{ lines: head }, { lines: body.lines }], footer };
      term.write(renderFrame({ ...frame, footerRight: footerRight(footer, cols) }, cols, rows));
      return;
    }
  ```
- `press()`: replace the notebook branch with:
  ```ts
    if (mode === "notebook") {
      const groups = notebookGroups(notebookEntries(course, core.state, t, opts.now()), t);
      const g = Math.max(0, Math.min(nbView.group, groups.length - 1));
      const words = groups[g]?.words ?? [];
      const v = nbView;
      if (key.name === "escape" || key.name === "n") mode = notebookFrom;
      else if (key.name === "1" || key.name === "2") nbView = { ...v, tab: key.name === "1" ? "words" : "notes", top: 0 };
      else if (v.tab === "notes") {
        if (key.name === "down") nbView = { ...v, top: v.top + 1 };
        else if (key.name === "up") nbView = { ...v, top: Math.max(0, v.top - 1) };
      } else if (key.name === "left" || key.name === "right") {
        const next = Math.max(0, Math.min(groups.length - 1, g + (key.name === "right" ? 1 : -1)));
        nbView = { ...v, group: next, word: 0, open: false };
      } else if (key.name === "up" || key.name === "down") {
        const next = Math.max(0, Math.min(words.length - 1, v.word + (key.name === "down" ? 1 : -1)));
        nbView = { ...v, group: g, word: next, open: false };
      } else if (key.name === "return") nbView = { ...v, open: !v.open };
      else if (key.name === "p") {
        hear(words[v.word]?.clips);
        flush();
      }
      return render();
    }
  ```
- Opening the notebook: replace `notebookTop = 0;` with `nbView = { tab: "words", group: 0, word: 0, open: false, top: 0 };`.
- Remove the now-unused `notebookLines` import and the `wrapLine` import if nothing else uses it (the notebook render above uses `wrapLine`, so it stays).

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm test && npm run typecheck`
Expected: PASS. The Task 3 size sweep now covers the new notebook too (it presses `n`).

- [ ] **Step 7: Commit**

```bash
git add packages/tui packages/view content/learner/en/ui.ftl
git commit -m "tui: a two-column notebook with recent words, memory bars and a notes tab"
```

---

### Task 5: The arrival title and credit

**Files:**
- Modify: `packages/tui/src/app.ts` (`tellIntro`)
- Test: `packages/tui/test/app.test.ts`

**Interfaces:**
- Consumes: the `credit` key (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
  it("names the game and its studio above the opening story, once", () => {
    const { term } = setup();
    const s = term.screen().join("\n");
    expect(s).toMatch(/Silver Tongue *│\n│ by Bannerless Studio/);
    expect(s.indexOf("by Bannerless Studio")).toBeLessThan(s.indexOf("You arrive with"));
    const under = setup((st) => (st.scenesDone.intro = 1));
    expect(under.term.screen().join("\n")).not.toContain("Bannerless");
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run packages/tui/test/app.test.ts -t "names the game"`
Expected: FAIL, because the screen has no "by Bannerless Studio".

- [ ] **Step 3: Implement**

In `app.ts`, replace `tellIntro` with:

```ts
  /** The opening story, for a game that hasn't started yet, under the game's name and its studio. */
  function tellIntro() {
    const story = introLines(course, core.state, t);
    if (!story.length) return;
    push([{ text: "Silver Tongue", bold: true, color: "cyan" }], [{ text: t("credit"), dim: true }], []);
    for (const line of story) push([{ text: line }], []);
  }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui
git commit -m "tui: the game's name and \"by Bannerless Studio\" above the opening story"
```

---

### Task 6: Check it for real, then release 0.16.1

**Files:**
- Modify: `CHANGELOG.md`, `packages/tui-node/package.json` (`version`), `docs/superpowers/specs/2026-09-27-tui-revamp-design.md` (the differences listed at the top of this plan)

- [ ] **Step 1: Play it**

Run `npm run play` in an 80×24 terminal, and at about 40 columns. Walk through: the arrival (title and credit), a scene (reading row, `w` then a word gives a card, a reply closes it), the notebook (`n`, `↑↓`, `←→`, `enter`, `2`, `esc`), and settings (`o`). Check the border colours on a light and a dark terminal theme.

- [ ] **Step 2: The text page**

Run: `export GITHUB_PACKAGES_TOKEN=$(gh auth token) && npm run build:site`
Expected: succeeds. Open `site/text/index.html` (serve `site/` with `npx serve site`) at phone width in the browser dev tools and play the same steps.

- [ ] **Step 3: Update the spec**

In `docs/superpowers/specs/2026-09-27-tui-revamp-design.md`, make the notebook section match what shipped: `[1]`/`[2]` for the tabs, Recent as the `recent` field, and the reading row also skipped when it only repeats the words. Also drop "base form when it differs" from the word card, and say the second fixture is the spaced course.

- [ ] **Step 4: Changelog and version**

`packages/tui-node/package.json`: `"version": "0.16.1"`.

`CHANGELOG.md`, above `## 0.16.0`:

```markdown
## 0.16.1 (<today's date>)

- The text game has a new look. The screen is split into boxes: where you are and what day it is at the top, then your money, how many days until rent and how well you speak, then the conversation, then your choices.
- Under a line someone says, you now see how it's pronounced (pinyin for Chinese), until you know every word in it.
- A word you look up opens in its own box above your choices, instead of in the conversation.
- The notebook has two columns: your words on the right, grouped by where you heard them, with the ones from the last day under Recent. A bar shows how well you remember each word. Press 2 for the notes you've been told.
- Silver Tongue is made by Bannerless Studio, and now says so.
```

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add CHANGELOG.md packages/tui-node/package.json docs/superpowers/specs/2026-09-27-tui-revamp-design.md
git commit -m "release: 0.16.1"
```

Ask the user before pushing `tui-revamp` and opening the pull request to `main`.
