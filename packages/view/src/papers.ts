import { personalize, wordState, type Course, type GameState, type Token } from "@silver-tongue/core";
import { extra } from "./course-extra";
import { readingsOf } from "./help";
import type { Text } from "./text";

/** One word on a paper: known words are shown, the rest are blanks with their reading. */
export interface PaperBlank {
  start: number;
  end: number;
  known: boolean;
  reading?: string;
}

/** A pinned NPC line (a notice, a form) kept in the Book once its scene is done. */
export interface Paper {
  scene: string;
  exchange: string;
  npc: string;
  place: string;
  npcName: string;
  placeName: string;
  /** the line, with the player's name in it */
  text: string;
  tokens: Token[];
  /** how many of its words are known */
  known: number;
  total: number;
  blanks: PaperBlank[];
}

/** Every pinned line of every scene done, in course order. */
export function papers(course: Course, state: GameState, t: Text, now: number): Paper[] {
  const name = state.player ?? "";
  const out: Paper[] = [];
  for (const scene of extra(course).scenes) {
    if (!(state.scenesDone[scene.id] ?? 0)) continue;
    for (const ex of scene.exchanges) {
      // A pinned exchange has no slots (the checker makes sure), so it has one variant.
      const v = ex.pin ? Object.values(ex.variants)[0] : undefined;
      if (!v) continue;
      const line = personalize(v.npc, name);
      const blanks = line.tokens.map((tk): PaperBlank => {
        const reading = readingsOf(course.words[tk.word], line.text.slice(tk.start, tk.end)).at(-1);
        return { start: tk.start, end: tk.end, known: wordState(state.words[tk.word], now) === "known", ...(reading ? { reading } : {}) };
      });
      out.push({
        scene: scene.id,
        exchange: ex.id,
        npc: scene.npc,
        place: scene.place,
        ...paperLabel(t, { npc: scene.npc, place: scene.place }),
        text: line.text,
        tokens: line.tokens,
        known: blanks.filter((b) => b.known).length,
        total: blanks.length,
        blanks,
      });
    }
  }
  return out;
}

/** Who handed the paper over, and where. */
export function paperLabel(t: Text, paper: { npc: string; place: string }): { npcName: string; placeName: string } {
  return { npcName: t(`npc-${paper.npc}`), placeName: t(`place-${paper.place}`) };
}
