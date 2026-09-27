import { PLAYER_MARK, rankFor, wordState, type Course, type GameState, type WordId, type WordState } from "@silver-tongue/core";
import { displayGloss } from "./help";
import type { Text } from "./text";

export interface NotebookWord {
  id: WordId;
  text: string;
  readings: string[];
  gloss: string;
  /** the short display gloss (curated override, else the heuristic): what the notebook row shows */
  short: string;
  state: WordState;
  clips: string[];
  /** the line it was first heard in, with the player's name */
  first?: string;
}
export interface NotebookGroup {
  /** null: heard before places were recorded */
  place: string | null;
  title: string;
  words: NotebookWord[];
}
export interface Notebook {
  /** what the player can now say, e.g. "Speaks: Pidgin" */
  rankLabel: string;
  progress: string[];
  empty: boolean;
  groups: NotebookGroup[];
  notes: { title: string; text: string }[];
}

/**
 * The notebook: progress on each stage's word list, the words heard so far grouped by the place
 * they were first heard (in world order), and the mentor notes already explained.
 */
export function notebookEntries(course: Course, state: GameState, t: Text, now: number): Notebook {
  const rankLabel = t("notebook-rank", { rank: t(`rank-${rankFor(state.words, Object.keys(course.words), now)}`) });
  const stages = [...new Set(course.scenes.map((s) => String(s.stage)))].sort();
  const progress = stages.map((stage) => {
    const list = course.stageWords[stage] ?? [];
    const states = list.map((w) => wordState(state.words[w], now));
    return t("notebook-progress", {
      stage,
      known: states.filter((s) => s === "known").length,
      total: list.length,
      heard: states.filter((s) => s !== "unseen").length,
    });
  });
  const heard = Object.keys(state.words).filter((w) => course.words[w]);
  const groups: NotebookGroup[] = [];
  for (const place of [...Object.keys(course.world.places), ""]) {
    const ids = heard.filter((w) => (state.words[w].first?.place ?? "") === place);
    if (!ids.length) continue;
    groups.push({
      place: place || null,
      title: place ? t(`place-${place}`) : t("notebook-elsewhere"),
      words: ids.map((id) => {
        const w = course.words[id];
        const rec = state.words[id];
        return {
          id,
          text: w.w,
          readings: w.readings ?? [],
          gloss: w.gloss,
          short: displayGloss(w),
          state: wordState(rec, now),
          clips: w.audio ?? [],
          // Saves from before 0.7.0 may hold the name's mark instead of the name.
          ...(rec.first ? { first: rec.first.line.split(PLAYER_MARK).join(state.player ?? "") } : {}),
        };
      }),
    });
  }
  return { rankLabel, progress, empty: !heard.length, groups, notes: state.notes.read.map((id) => ({ title: t(`note-${id}-title`), text: t(`note-${id}`) })) };
}
