import type { RenderedLine, WordId } from "@silver-tongue/core";
import type { StyledLine } from "./terminal";
import { fitLine, strWidth, wrapLine } from "./width";

export interface ScreenModel {
  title: string;
  hud: string;
  log: StyledLine[];
  prompt: StyledLine[];
  footer: string;
  /** shown at the right of the bottom border, e.g. "Silver Tongue v0.5.0" */
  footerRight?: string;
}

/** A line of the language being learned; words met for the first time are underlined. */
export function lineSpans(line: RenderedLine, fresh: Set<WordId>): StyledLine {
  const out: StyledLine = [];
  let at = 0;
  for (const t of line.tokens) {
    if (t.start > at) out.push({ text: line.text.slice(at, t.start) });
    out.push({ text: line.text.slice(t.start, t.end), underline: fresh.has(t.word) });
    at = t.end;
  }
  if (at < line.text.length) out.push({ text: line.text.slice(at) });
  return out;
}

/** Lays out short items (tiles, words) left to right, starting a new line when one would not fit. */
export function wrapItems(items: string[], width: number, gap = "  "): StyledLine[] {
  const lines: string[] = [];
  for (const item of items) {
    const last = lines.at(-1);
    if (last !== undefined && strWidth(last) + strWidth(gap) + strWidth(item) <= width) lines[lines.length - 1] = last + gap + item;
    else lines.push(item);
  }
  return lines.map((text) => [{ text }]);
}

/** A label shortened to `width`: whole " · " parts dropped from the end first, then cut. */
function shorten(label: string, width: number): string {
  let parts = label.split(" · ");
  while (parts.length > 1 && strWidth(parts.join(" · ")) > width) parts = parts.slice(0, -1);
  const text = parts.join(" · ");
  return strWidth(text) <= width ? text : fitLine([{ text }], width).map((sp) => sp.text).join("");
}

/** keepRight: the right label stays whole and the left one gives way (else the right is cut). */
function border(left: string, label: string, right: string, fill: string, cols: number, rightLabel = "", keepRight = false): StyledLine {
  const inner = cols - 2;
  const r = rightLabel ? ` ${rightLabel} ` : "";
  const l = !label ? "" : keepRight ? ` ${shorten(label, Math.max(0, inner - strWidth(r) - 2))} ` : ` ${label} `;
  const gap = Math.max(0, inner - strWidth(l) - strWidth(r));
  return fitLine(
    [
      { text: left, dim: true },
      { text: l, bold: true },
      { text: fill.repeat(gap), dim: true },
      { text: r },
      { text: right, dim: true },
    ],
    cols,
  );
}

/** Frames the screen: title and HUD on top, the log, the prompt, key hints at the bottom. Long lines wrap. */
export function renderScreen(m: ScreenModel, cols: number, rows: number): StyledLine[] {
  const inner = Math.max(1, cols - 4);
  const bodyRows = Math.max(1, rows - 2);
  const wrap = (lines: StyledLine[]) => lines.flatMap((l) => wrapLine(l, inner));
  const prompt = wrap(m.prompt).slice(-bodyRows);
  // A blank line separates the log from the prompt, only when a log line fits above it too.
  const gap = prompt.length && bodyRows - prompt.length >= 2 ? 1 : 0;
  const logRows = Math.max(0, bodyRows - prompt.length - gap);
  const log = logRows > 0 ? wrap(m.log).slice(-logRows) : []; // slice(-0) would be the whole log
  const body: StyledLine[] = [...Array(logRows - log.length).fill([]), ...log];
  if (gap) body.push([]);
  body.push(...prompt);
  return [
    border("┌", m.title, "┐", "─", cols, m.hud),
    ...body.map((l) => [{ text: "│ ", dim: true }, ...fitLine(l, inner), { text: " │", dim: true }]),
    // The bottom right says whether sound works; the key hints give way to it.
    border("└", m.footer, "┘", "─", cols, m.footerRight, true),
  ];
}
