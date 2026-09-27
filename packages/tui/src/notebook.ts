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
