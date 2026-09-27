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
  /** rows the growing panel keeps before optional panels do (default 1), so the line being answered shows */
  min?: number;
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
 * first; the growing one (the log) gets the rest. When its `min` rows don't fit, the optional
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
  const least = (p: (typeof panels)[number]) => Math.max(1, Math.min(p.min ?? 1, p.rows.length));
  const need = () => panels.reduce((n, p, i) => n + (i > 0 ? 1 : 0) + (p.grow ? least(p) : p.rows.length), 0);
  while (need() > avail && panels.some((p) => p.drop !== undefined)) {
    const top = Math.max(...panels.map((p) => p.drop ?? -Infinity));
    const i = panels.findIndex((p) => p.drop === top);
    panels = panels.filter((_, j) => j !== i);
  }
  const growing = panels.some((p) => p.grow);
  const growRows = Math.max(0, avail - (need() - panels.reduce((n, p) => n + (p.grow ? least(p) : 0), 0)));
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
