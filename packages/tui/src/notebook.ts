import { wordState, type Course, type GameState, type WordState } from "@silver-tongue/core";
import type { StyledLine } from "./terminal";
import type { Text } from "./text";

const MARK: Record<WordState, string> = { unseen: " ", met: "○", shaky: "◐", known: "●" };

/**
 * The notebook: progress on each stage's word list, the words heard so far grouped by the place
 * they were first heard (in world order), and the mentor notes already explained.
 */
export function notebookLines(course: Course, state: GameState, t: Text, now: number): StyledLine[] {
  const out: StyledLine[] = [];
  const stages = [...new Set(course.scenes.map((s) => String(s.stage)))].sort();
  for (const stage of stages) {
    const list = course.stageWords[stage] ?? [];
    const states = list.map((w) => wordState(state.words[w], now));
    out.push([
      {
        text: t("notebook-progress", {
          stage,
          known: states.filter((s) => s === "known").length,
          total: list.length,
          heard: states.filter((s) => s !== "unseen").length,
        }),
        bold: true,
      },
    ]);
  }

  const heard = Object.keys(state.words).filter((w) => course.words[w]);
  if (!heard.length) out.push([], [{ text: t("notebook-empty"), dim: true }]);
  const places = [...Object.keys(course.world.places), ""];
  for (const place of places) {
    const words = heard.filter((w) => (state.words[w].first?.place ?? "") === place);
    if (!words.length) continue;
    out.push([], [{ text: place ? t(`place-${place}`) : t("notebook-elsewhere"), color: "cyan", bold: true }]);
    for (const id of words) {
      const w = course.words[id];
      const rec = state.words[id];
      out.push([
        { text: `${MARK[wordState(rec, now)]} ` },
        { text: w.w, bold: true },
        ...(w.pron ? [{ text: ` ${w.pron}`, color: "yellow" as const }] : []),
        { text: ` — ${w.gloss}` },
      ]);
      if (rec.first) out.push([{ text: `    ${rec.first.line}`, dim: true }]);
    }
  }

  if (state.notes.read.length) {
    out.push([], [{ text: t("notebook-notes"), color: "cyan", bold: true }]);
    for (const id of state.notes.read) out.push([{ text: t(`note-${id}-title`), bold: true }], [{ text: t(`note-${id}`) }], []);
  }
  return out;
}
