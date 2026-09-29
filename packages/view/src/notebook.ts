import { DAY_MS, personalize, placeKnown, PLAYER_MARK, rankFor, wordState, type Course, type GameState, type WordId, type WordRecord, type WordState } from "@silver-tongue/core";
import { displayGloss, sentenceCard } from "./help";
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
  /** set phrases from the conversations had, by conversation */
  phrases: { title: string; phrases: NotebookPhrase[] }[];
  /** the people met, in the order the course introduces them */
  people: NotebookPerson[];
  /** the places known, in world order */
  places: NotebookPlace[];
}

export interface NotebookPhrase {
  text: string;
  reading: string;
  meaning: string;
  clips: string[];
}
export interface NotebookPerson {
  name: string;
  place: string;
  /** 0-5: how well they know you */
  trust: number;
  /** the conversations had with them */
  scenes: string[];
}
export interface NotebookPlace {
  name: string;
  desc: string;
  people: string[];
  here: boolean;
}

/**
 * Set phrases: the lines of each conversation done whose exchange has no slots to vary (a greeting,
 * an introduction), both sides, each once.
 */
function phrasesOf(course: Course, state: GameState, t: Text): Notebook["phrases"] {
  const name = state.player ?? "";
  const seen = new Set<string>();
  const out: Notebook["phrases"] = [];
  for (const scene of course.scenes) {
    if (!(state.scenesDone[scene.id] ?? 0)) continue;
    const phrases: NotebookPhrase[] = [];
    for (const ex of scene.exchanges) {
      const v = ex.variants[""];
      if (!v) continue;
      for (const l of [v.npc, v.reply]) {
        const card = sentenceCard(course, personalize(l, name));
        if (!card || seen.has(card.text)) continue;
        seen.add(card.text);
        phrases.push({ text: card.text, reading: card.reading, meaning: card.meaning, clips: card.clips });
      }
    }
    if (phrases.length) out.push({ title: t(`scene-${scene.id}`), phrases });
  }
  return out;
}

function peopleOf(course: Course, state: GameState, t: Text): NotebookPerson[] {
  const out = new Map<string, NotebookPerson>();
  for (const scene of course.scenes) {
    if (!(state.scenesDone[scene.id] ?? 0)) continue;
    const p = out.get(scene.npc) ?? {
      name: t(`npc-${scene.npc}`),
      place: t(`place-${course.world.npcs[scene.npc]?.place ?? scene.place}`),
      trust: Math.min(5, state.trust[scene.npc] ?? 0),
      scenes: [],
    };
    p.scenes.push(t(`scene-${scene.id}`));
    out.set(scene.npc, p);
  }
  return [...out.values()];
}

function placesOf(course: Course, state: GameState, t: Text): NotebookPlace[] {
  const met = new Set(course.scenes.filter((s) => state.scenesDone[s.id]).map((s) => s.npc));
  return Object.keys(course.world.places)
    .filter((p) => placeKnown(course, state, p))
    .map((p) => ({
      name: t(`place-${p}`),
      desc: t.has(`place-${p}-desc`) ? t(`place-${p}-desc`) : "",
      people: Object.entries(course.world.npcs).filter(([id, n]) => n.place === p && met.has(id)).map(([id]) => t(`npc-${id}`)),
      here: p === state.place,
    }));
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
  return {
    rankLabel,
    progress,
    empty: !heard.length,
    groups,
    recent,
    notes: state.notes.read.map((id) => ({ title: t(`note-${id}-title`), text: t(`note-${id}`) })),
    phrases: phrasesOf(course, state, t),
    people: peopleOf(course, state, t),
    places: placesOf(course, state, t),
  };
}
