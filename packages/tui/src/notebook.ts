import type { Notebook, NotebookLabel, NotebookPhrase, NotebookWord, Text } from "@silver-tongue/view";
import { innerWidth, NARROW } from "./panel";
import type { Span, StyledLine } from "./terminal";
import { fitLine, strWidth, wrapLine } from "./width";

export const NOTEBOOK_TABS = ["words", "phrases", "people", "places", "notes"] as const;
export type NotebookTab = (typeof NOTEBOOK_TABS)[number];

export interface NotebookView {
  tab: NotebookTab;
  /** Words and Phrases: the chosen group */
  group: number;
  /** the chosen word or phrase in that group */
  word: number;
  /** the chosen word shows the line it was first heard in */
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
export function notebookHead(nb: Notebook, t: Text, tab: NotebookTab): StyledLine[] {
  const tabs = NOTEBOOK_TABS.flatMap((id, i): Span[] => [
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

/**
 * The notebook below its head, exactly `height` lines. Words and Phrases: groups and items in two
 * columns (see columns). People, Places and Notes: a list from line `v.top` (clamped; the top used
 * is returned).
 */
export function notebookBody(nb: Notebook, t: Text, v: NotebookView, cols: number, height: number): { lines: StyledLine[]; top: number } {
  const inner = innerWidth(cols);
  const empty = (id: string) => ({ lines: pad(wrapLine([{ text: t(id), dim: true }], inner), height), top: 0 });
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
