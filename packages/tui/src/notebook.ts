import type { Course, GameState, WordState } from "@silver-tongue/core";
import { notebookEntries, type Text } from "@silver-tongue/view";
import type { StyledLine } from "./terminal";

const MARK: Record<WordState, string> = { unseen: " ", met: "○", shaky: "◐", known: "●" };

/** The notebook as terminal lines (see notebookEntries for what it holds). */
export function notebookLines(course: Course, state: GameState, t: Text, now: number): StyledLine[] {
  const nb = notebookEntries(course, state, t, now);
  const out: StyledLine[] = nb.progress.map((text) => [{ text, bold: true }]);
  if (nb.empty) out.push([], [{ text: t("notebook-empty"), dim: true }]);
  for (const g of nb.groups) {
    out.push([], [{ text: g.title, color: "cyan", bold: true }]);
    for (const w of g.words) {
      out.push([
        { text: `${MARK[w.state]} ` },
        { text: w.text, bold: true },
        ...(w.readings.length ? [{ text: ` ${w.readings.join(" ")}`, color: "yellow" as const }] : []),
        { text: ` — ${w.gloss}` },
      ]);
      if (w.first !== undefined) out.push([{ text: `    ${w.first}`, dim: true }]);
    }
  }
  if (nb.notes.length) {
    out.push([], [{ text: t("notebook-notes"), color: "cyan", bold: true }]);
    for (const n of nb.notes) out.push([{ text: n.title, bold: true }], [{ text: n.text }], []);
  }
  return out;
}
