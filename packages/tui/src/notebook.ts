import type { Course } from "@silver-tongue/core";
import { paperGlosses, paperParts, type LettersGroupView, type Notebook, type NotebookLabel, type NotebookPhrase, type NotebookWord, type Paper, type Text } from "@silver-tongue/view";
import { innerWidth, NARROW } from "./panel";
import type { Span, StyledLine } from "./terminal";
import { fitLine, strWidth, wrapLine } from "./width";

export const NOTEBOOK_TABS = ["letters", "words", "phrases", "papers", "people", "places", "notes"] as const;
export type NotebookTab = (typeof NOTEBOOK_TABS)[number];

/** The Book's tabs for a course, in order: Letters only when the language has a letter chart. */
export const notebookTabs = (letters: boolean): NotebookTab[] => NOTEBOOK_TABS.filter((id) => letters || id !== "letters");

/** What the Letters and Papers tabs show: the course's letter chart and the papers kept. */
export interface BookExtras {
  course: Course;
  letters: LettersGroupView[];
  papers: Paper[];
}

export interface NotebookView {
  tab: NotebookTab;
  /** Words and Phrases: the chosen group */
  group: number;
  /** the chosen word or phrase in that group; Letters: the chosen letter, counted across groups; Papers: the chosen paper */
  word: number;
  /** the chosen word shows the line it was first heard in; the chosen paper shows its line */
  open: boolean;
  /** People, Places and Notes: the first line on screen */
  top: number;
}

/** Widest the group list on the left gets, when there's room for two columns. */
const LEFT_MAX = 28;
const BAR = 5;
const TRUST = 5;
const LABELS: NotebookLabel[] = ["new", "met", "shaky", "known"];
const LABEL_STYLE: Record<NotebookLabel, Omit<Span, "text">> = { new: { color: "red", inverse: true }, met: {}, shaky: { color: "yellow" }, known: { color: "green" } };

/** A group of the left column, with the items it shows on the right. */
export interface Group<T> {
  title: string;
  items: T[];
}

/**
 * The Words tab's groups: Recent first, then each topic and place. Recent is left out when it's
 * empty, or when it holds every word heard: then it only repeats the other groups.
 */
export function notebookGroups(nb: Notebook, t: Text): Group<NotebookWord>[] {
  const all = nb.groups.reduce((n, g) => n + g.words.length, 0);
  const recent = nb.recent.length && nb.recent.length < all;
  return [...(recent ? [{ title: t("notebook-recent"), items: nb.recent }] : []), ...nb.groups.map((g) => ({ title: g.title, items: g.words }))];
}

/** The Phrases tab's groups: one per conversation. */
export function phraseGroups(nb: Notebook): Group<NotebookPhrase>[] {
  return nb.phrases.map((g) => ({ title: g.title, items: g.phrases }));
}

/** The tab line, then (on Words) progress on each stage's word list. */
export function notebookHead(nb: Notebook, t: Text, tab: NotebookTab, shown: readonly NotebookTab[] = notebookTabs(false)): StyledLine[] {
  const tabs = shown.flatMap((id, i): Span[] => [
    ...(i ? [{ text: "  " }] : []),
    id === tab ? { text: `${i + 1}) ${t(`notebook-${id}`)}`, bold: true, color: "cyan" } : { text: `${i + 1}) ${t(`notebook-${id}`)}`, dim: true },
  ]);
  return [tabs, ...(tab === "words" ? nb.progress.map((text) => [{ text, dim: true }]) : [])];
}

/** A word's rows: text, readings, bar and label (a badge when new); its short gloss; and, opened, its first line. */
function wordRows(w: NotebookWord, chosen: boolean, open: boolean, width: number, t: Text): StyledLine[] {
  const labelWidth = Math.max(...LABELS.map((l) => strWidth(t(`notebook-label-${l}`)))) + 2;
  const label = t(`notebook-label-${w.label}`);
  const tag = w.label === "new" ? ` ${label} ` : label;
  const tail: StyledLine = [
    { text: " " },
    ...(w.label === "new"
      ? [{ text: " ".repeat(BAR) }]
      : [{ text: "█".repeat(w.bar), ...LABEL_STYLE[w.label] }, { text: "░".repeat(BAR - w.bar), dim: true }]),
    { text: " " },
    { text: tag, ...LABEL_STYLE[w.label] },
    { text: " ".repeat(Math.max(0, labelWidth - strWidth(tag))) },
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

/** A phrase's rows: the phrase, its reading, and its meaning. */
function phraseRows(p: NotebookPhrase, chosen: boolean, width: number): StyledLine[] {
  return [
    ...wrapLine([{ text: chosen ? "▸ " : "  ", bold: true }, { text: p.text, bold: true }], width),
    ...(p.reading ? wrapLine([{ text: "    " }, { text: p.reading, color: "yellow" }], width) : []),
    ...wrapLine([{ text: "    " }, { text: p.meaning, dim: true }], width),
  ];
}

const pad = (lines: StyledLine[], height: number): StyledLine[] => [...lines, ...Array(Math.max(0, height - lines.length)).fill([])].slice(0, height);

/**
 * Groups on the left and the chosen group's items on the right, scrolled so the chosen item shows;
 * at phone width, one column under a "◂ group ▸" line.
 */
function columns<T>(groups: Group<T>[], v: NotebookView, cols: number, height: number, rowsOf: (item: T, chosen: boolean, width: number) => StyledLine[]): StyledLine[] {
  const inner = innerWidth(cols);
  const g = Math.max(0, Math.min(v.group, groups.length - 1));
  const narrow = cols < NARROW;
  const label = (gr: Group<T>) => `${gr.title} (${gr.items.length})`;
  const leftWidth = Math.min(LEFT_MAX, 2 + Math.max(...groups.map((gr) => strWidth(label(gr)))));
  const rightWidth = narrow ? inner : inner - leftWidth - 3;
  const items = groups[g].items;
  const chosen = Math.max(0, Math.min(v.word, items.length - 1));
  const blocks = items.map((item, i) => rowsOf(item, i === chosen, rightWidth));
  const listHeight = narrow ? height - 1 : height;
  const start = blocks.slice(0, chosen).reduce((n, b) => n + b.length, 0);
  const end = start + blocks[chosen].length;
  const top = Math.max(0, Math.min(start, end - listHeight));
  const right = blocks.flat().slice(top, top + listHeight);
  const name = label(groups[g]);
  if (narrow) {
    const nav: StyledLine = [
      { text: g > 0 ? "◂ " : "  ", dim: true },
      { text: name, bold: true, color: "cyan" },
      { text: g < groups.length - 1 ? " ▸" : "", dim: true },
    ];
    return pad([fitLine(nav, inner), ...right], height);
  }
  const leftTop = Math.max(0, g - height + 1);
  const left = groups.map((gr, i) =>
    fitLine([{ text: i === g ? "▸ " : "  ", bold: true }, { text: label(gr), ...(i === g ? { bold: true, color: "cyan" as const } : {}) }], leftWidth),
  );
  return Array.from({ length: height }, (_, r): StyledLine => [
    ...(left[leftTop + r] ?? fitLine([], leftWidth)),
    { text: " │ ", dim: true },
    ...(right[r] ?? []),
  ]);
}

/** People: name and where they are, how well they know you, and what you've talked about. */
function peopleLines(nb: Notebook, t: Text, width: number): StyledLine[] {
  return nb.people.flatMap((p) => [
    ...wrapLine(
      [
        { text: p.name, bold: true },
        { text: ` · ${p.place}  `, dim: true },
        { text: "█".repeat(p.trust), color: "magenta" },
        { text: "░".repeat(TRUST - p.trust), dim: true },
        { text: ` ${t("notebook-trust")}`, dim: true },
      ],
      width,
    ),
    ...wrapLine([{ text: "  " }, { text: t("notebook-talked", { scenes: p.scenes.join(", ") }), dim: true }], width),
    [],
  ]);
}

/** Places: name (and whether you're there), what it's like, and who you know there. */
function placeLines(nb: Notebook, t: Text, width: number): StyledLine[] {
  return nb.places.flatMap((p) => [
    ...wrapLine([{ text: p.name, bold: true }, ...(p.here ? [{ text: `  ◂ ${t("notebook-here")}`, color: "cyan" as const }] : [])], width),
    ...(p.desc ? wrapLine([{ text: "  " }, { text: p.desc, dim: true }], width) : []),
    ...(p.people.length ? wrapLine([{ text: "  " }, { text: p.people.join(", "), color: "cyan" }], width) : []),
    [],
  ]);
}

/** The widest a letter cell gets: letters and readings past it are cut. */
const CELL_MAX = 12;

/** How wide each letter cell is and how many fit on a row. */
export function letterGrid(groups: LettersGroupView[], cols: number): { cell: number; perRow: number } {
  const inner = innerWidth(cols);
  const widest = Math.max(2, ...groups.flatMap((g) => g.letters.flatMap((l) => [strWidth(l.ch), strWidth(l.reading ?? "")])));
  const cell = Math.min(CELL_MAX, inner, widest + 3);
  return { cell, perRow: Math.max(1, Math.floor(inner / cell)) };
}

/** The letters' grid rows, group by group: each row the letters' indices counted across groups. */
function letterRows(groups: LettersGroupView[], perRow: number): number[][] {
  const rows: number[][] = [];
  let at = 0;
  for (const g of groups) {
    for (let i = 0; i < g.letters.length; i += perRow) rows.push(Array.from({ length: Math.min(perRow, g.letters.length - i) }, (_, k) => at + i + k));
    at += g.letters.length;
  }
  return rows;
}

/** The letter an arrow key moves to: along the chart, or to the same column of the row above or below. */
export function moveLetter(groups: LettersGroupView[], cols: number, at: number, key: "up" | "down" | "left" | "right"): number {
  const count = groups.reduce((n, g) => n + g.letters.length, 0);
  if (!count) return 0;
  const here = Math.max(0, Math.min(at, count - 1));
  if (key === "left" || key === "right") return Math.max(0, Math.min(count - 1, here + (key === "right" ? 1 : -1)));
  const rows = letterRows(groups, letterGrid(groups, cols).perRow);
  const r = rows.findIndex((row) => row.includes(here));
  const next = rows[r + (key === "down" ? 1 : -1)];
  return next ? next[Math.min(rows[r].indexOf(here), next.length - 1)] : here;
}

/** Lines scrolled so the lines from `start` to `end` show, exactly `height` of them. */
function scrolledTo(all: StyledLine[], start: number, end: number, height: number): StyledLine[] {
  const top = Math.max(0, Math.min(start, end - height, all.length - height));
  return pad(all.slice(top, top + height), height);
}

/** Letters: each group's name, then its letters in a grid, each over how it sounds; the chosen one lit. */
function letterLines(groups: LettersGroupView[], v: NotebookView, cols: number, height: number): StyledLine[] {
  const { cell, perRow } = letterGrid(groups, cols);
  const count = groups.reduce((n, g) => n + g.letters.length, 0);
  const chosen = Math.max(0, Math.min(v.word, count - 1));
  const cellOf = (text: string, style: Omit<Span, "text">): Span[] => fitLine([{ text: " " }, ...(text ? [{ text, ...style }] : [])], cell);
  const all: StyledLine[] = [];
  let focus = 0;
  let at = 0;
  groups.forEach((g, gi) => {
    if (gi) all.push([]);
    all.push([{ text: g.label, bold: true, color: "green" }]);
    for (let i = 0; i < g.letters.length; i += perRow) {
      const row = g.letters.slice(i, i + perRow);
      const first = at + i;
      if (chosen >= first && chosen < first + row.length) focus = all.length;
      all.push(row.flatMap((l, k) => cellOf(l.ch, first + k === chosen ? { bold: true, color: "cyan", inverse: true } : { bold: true })));
      all.push(row.flatMap((l) => cellOf(l.reading ?? "", { color: "yellow", dim: true })));
    }
    at += g.letters.length;
  });
  return scrolledTo(all, Math.max(0, focus - 1), focus + 2, height);
}

const PAPER_BAR = 4;

/** A paper's line: known words as they are, the rest as blanks, or their reading (dim) when there is one. */
export function paperLine(p: Paper): StyledLine {
  return paperParts(p).map((part): Span =>
    !("word" in part)
      ? { text: part.text }
      : part.blank.known
        ? { text: part.text, bold: true }
        : part.blank.reading
          ? { text: part.blank.reading, color: "yellow", dim: true }
          : { text: "____", dim: true },
  );
}

/** Papers: who handed each over and where, and how much of it is known; the chosen one opened shows its line and the known words' glosses. */
function paperLines(ex: BookExtras, t: Text, v: NotebookView, width: number, height: number): StyledLine[] {
  const chosen = Math.max(0, Math.min(v.word, ex.papers.length - 1));
  const all: StyledLine[] = [];
  let start = 0;
  let end = 0;
  ex.papers.forEach((p, i) => {
    const filled = p.total ? Math.round((p.known / p.total) * PAPER_BAR) : 0;
    if (i === chosen) start = all.length;
    all.push(
      fitLine(
        [
          { text: i === chosen ? "▸ " : "  ", bold: true },
          { text: t("notebook-paper-from", { npc: p.npcName, place: p.placeName }), ...(i === chosen ? { bold: true, color: "cyan" as const } : {}) },
          { text: "  " },
          { text: "█".repeat(filled), color: "green" },
          { text: "░".repeat(PAPER_BAR - filled), dim: true },
          { text: ` ${p.known}/${p.total}`, dim: true },
        ],
        width,
      ),
    );
    if (i === chosen && v.open) {
      all.push(...wrapLine([{ text: "    " }, ...paperLine(p)], width));
      for (const g of paperGlosses(ex.course, p)) all.push(...wrapLine([{ text: "    " }, { text: g.text, bold: true }, { text: `  ${g.gloss}`, dim: true }], width));
    }
    if (i === chosen) end = all.length;
  });
  return scrolledTo(all, start, end, height);
}

/**
 * The notebook below its head, exactly `height` lines. Words and Phrases: groups and items in two
 * columns (see columns). Letters and Papers (from `ex`): scrolled to the chosen letter or paper.
 * People, Places and Notes: a list from line `v.top` (clamped; the top used is returned).
 */
export function notebookBody(nb: Notebook, t: Text, v: NotebookView, cols: number, height: number, ex?: BookExtras): { lines: StyledLine[]; top: number } {
  const inner = innerWidth(cols);
  const empty = (id: string) => ({ lines: pad(wrapLine([{ text: t(id), dim: true }], inner), height), top: 0 });
  if (v.tab === "letters") return { lines: letterLines(ex?.letters ?? [], v, cols, height), top: 0 };
  if (v.tab === "papers") {
    if (!ex?.papers.length) return empty("notebook-papers-empty");
    return { lines: paperLines(ex, t, v, inner, height), top: 0 };
  }
  if (v.tab === "words") {
    if (nb.empty) return empty("notebook-empty");
    return { lines: columns(notebookGroups(nb, t), v, cols, height, (w, chosen, width) => wordRows(w, chosen, v.open && chosen, width, t)), top: 0 };
  }
  if (v.tab === "phrases") {
    if (!nb.phrases.length) return empty("notebook-phrases-empty");
    return { lines: columns(phraseGroups(nb), v, cols, height, phraseRows), top: 0 };
  }
  const all: StyledLine[] =
    v.tab === "people"
      ? nb.people.length
        ? peopleLines(nb, t, inner)
        : wrapLine([{ text: t("notebook-people-empty"), dim: true }], inner)
      : v.tab === "places"
        ? placeLines(nb, t, inner)
        : nb.notes.length
          ? nb.notes.flatMap((n) => [...wrapLine([{ text: n.title, bold: true }], inner), ...wrapLine([{ text: n.text }], inner), []])
          : wrapLine([{ text: t("notebook-notes-empty"), dim: true }], inner);
  const top = Math.max(0, Math.min(v.top, all.length - height));
  return { lines: pad(all.slice(top, top + height), height), top };
}
