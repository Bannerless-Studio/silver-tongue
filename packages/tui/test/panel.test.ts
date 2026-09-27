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
