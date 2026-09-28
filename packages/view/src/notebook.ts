import { DAY_MS, PLAYER_MARK, rankFor, wordState, type Course, type GameState, type WordId, type WordRecord, type WordState } from "@silver-tongue/core";
import { displayGloss } from "./help";
import type { Text } from "./text";

/** What the notebook calls a word: "new" until it is first answered right, then its state. */
export type NotebookLabel = "new" | "met" | "shaky" | "known";

export interface NotebookWord {
  id: WordId;
  text: string;
  readings: string[];
  gloss: string;
  /** the short display gloss (curated override, else the heuristic): what the notebook row shows */
  short: string;
  state: WordState;
  /** memory: the right-answer streak, 0-5 cells */
  bar: number;
  label: NotebookLabel;
  clips: string[];
  /** the line it was first heard in, with the player's name */
  first?: string;
}
export interface NotebookGroup {
  /** null: a topic, or heard before places were recorded */
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
  /** words first heard within the last day of play, newest first */
  recent: NotebookWord[];
  notes: { title: string; text: string }[];
}

/**
 * Each word's topic title: a slot group the learner text names (`notebook-topic-<group>`) files its
 * concepts' words under that name. Groups sharing a name make one topic.
 */
function topicOf(course: Course, t: Text): Map<WordId, string> {
  const out = new Map<WordId, string>();
  for (const [group, concepts] of Object.entries(course.groups)) {
    const id = `notebook-topic-${group}`;
    if (!t.has(id)) continue;
    for (const c of concepts) for (const w of course.concepts[c] ?? []) if (!out.has(w)) out.set(w, t(id));
  }
  return out;
}

/**
 * The notebook: progress on each stage's word list, the words heard so far grouped by topic where
 * the learner text names one, else by the place they were first heard (in world order), and the
 * mentor notes already explained.
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
    });
  });
  const heard = Object.keys(state.words).filter((w) => course.words[w]);
  const entry = (id: WordId): NotebookWord => {
    const w = course.words[id];
    const rec: WordRecord = state.words[id];
    const st = wordState(rec, now);
    return {
      id,
      text: w.w,
      readings: w.readings ?? [],
      gloss: w.gloss,
      short: displayGloss(w),
      state: st,
      bar: Math.min(rec.streak, 5),
      label: st === "met" && rec.streak === 0 ? "new" : (st as NotebookLabel),
      clips: w.audio ?? [],
      // Saves from before 0.7.0 may hold the name's mark instead of the name.
      ...(rec.first ? { first: rec.first.line.split(PLAYER_MARK).join(state.player ?? "") } : {}),
    };
  };
  const groups: NotebookGroup[] = [];
  const topics = topicOf(course, t);
  for (const title of new Set(heard.flatMap((w) => topics.get(w) ?? []))) {
    groups.push({ place: null, title, words: heard.filter((w) => topics.get(w) === title).map(entry) });
  }
  for (const place of [...Object.keys(course.world.places), ""]) {
    const ids = heard.filter((w) => !topics.has(w) && (state.words[w].first?.place ?? "") === place);
    if (!ids.length) continue;
    groups.push({ place: place || null, title: place ? t(`place-${place}`) : t("notebook-elsewhere"), words: ids.map(entry) });
  }
  const recent = heard
    .filter((id) => state.words[id].firstSeen >= now - DAY_MS)
    .sort((a, b) => state.words[b].firstSeen - state.words[a].firstSeen)
    .map(entry);
  return { rankLabel, progress, empty: !heard.length, groups, recent, notes: state.notes.read.map((id) => ({ title: t(`note-${id}-title`), text: t(`note-${id}`) })) };
}
