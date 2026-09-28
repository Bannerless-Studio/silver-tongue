import type { RenderedLine, WordId } from "@silver-tongue/core";
import type { StyledLine } from "./terminal";
import { lineWidth, strWidth, wrapLine } from "./width";

/** A line of the language being learned; words met for the first time are underlined, in cyan. */
export function lineSpans(line: RenderedLine, fresh: Set<WordId>): StyledLine {
  const out: StyledLine = [];
  let at = 0;
  for (const t of line.tokens) {
    if (t.start > at) out.push({ text: line.text.slice(at, t.start) });
    const text = line.text.slice(t.start, t.end);
    out.push(fresh.has(t.word) ? { text, underline: true, color: "cyan" } : { text });
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

/**
 * A card opened under a word: a dotted stem at `col` (the word's column), then a box as wide as its
 * rows need, starting under the word when there's room and shifted left when there isn't.
 */
export function cardBox(rows: StyledLine[], col: number, width: number): StyledLine[] {
  const boxWidth = Math.min(width, Math.max(...rows.map(lineWidth)) + 4);
  const left = Math.max(0, Math.min(col, width - boxWidth));
  const inside = rows.flatMap((r) => wrapLine(r, boxWidth - 4));
  const indent = { text: " ".repeat(left) };
  const edge = (text: string): StyledLine => [indent, { text, color: "cyan", dim: true }];
  const stem = Math.min(col, width - 1);
  // The top border meets the stem: a tee where it lands, a corner-tee when that's the corner.
  const top = [...`┌${"─".repeat(boxWidth - 2)}┐`];
  const k = stem - left;
  if (k >= 0 && k < boxWidth) top[k] = k === 0 ? "├" : k === boxWidth - 1 ? "┤" : "┴";
  return [
    [{ text: " ".repeat(stem) }, { text: "┆", color: "cyan", dim: true }],
    edge(top.join("")),
    ...inside.map((r): StyledLine => [
      indent,
      { text: "│ ", color: "cyan", dim: true },
      ...r,
      { text: " ".repeat(Math.max(0, boxWidth - 4 - lineWidth(r))) },
      { text: " │", color: "cyan", dim: true },
    ]),
    edge(`└${"─".repeat(boxWidth - 2)}┘`),
  ];
}
