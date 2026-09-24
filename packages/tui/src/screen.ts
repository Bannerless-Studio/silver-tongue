import type { RenderedLine, WordId } from "@silver-tongue/core";
import type { StyledLine } from "./terminal";
import { fitLine, strWidth } from "./width";

export interface ScreenModel {
  title: string;
  hud: string;
  log: StyledLine[];
  prompt: StyledLine[];
  footer: string;
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

function border(left: string, label: string, right: string, fill: string, cols: number, rightLabel = ""): StyledLine {
  const inner = cols - 2;
  const l = label ? ` ${label} ` : "";
  const r = rightLabel ? ` ${rightLabel} ` : "";
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

/** Frames the screen: title and HUD on top, the log, the prompt, key hints at the bottom. */
export function renderScreen(m: ScreenModel, cols: number, rows: number): StyledLine[] {
  const inner = Math.max(1, cols - 4);
  const bodyRows = Math.max(1, rows - 2);
  const prompt = m.prompt.slice(-bodyRows);
  const logRows = Math.max(0, bodyRows - prompt.length - (prompt.length ? 1 : 0));
  const log = m.log.slice(-logRows);
  const body: StyledLine[] = [...Array(logRows - log.length).fill([]), ...log];
  if (prompt.length) body.push([]);
  body.push(...prompt);
  return [
    border("┌", m.title, "┐", "─", cols, m.hud),
    ...body.map((l) => [{ text: "│ ", dim: true }, ...fitLine(l, inner), { text: " │", dim: true }]),
    border("└", m.footer, "┘", "─", cols),
  ];
}
