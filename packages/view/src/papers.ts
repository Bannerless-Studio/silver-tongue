import { personalize, wordState, type Course, type GameState, type Token, type WordId } from "@silver-tongue/core";
import { extra } from "./course-extra";
import { displayGloss, readingsOf } from "./help";
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
  /** the line's clips */
  audio: string[];
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
        audio: line.audio ?? [],
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

/** A piece of a paper's line: the text between words, or a word, known or a blank. */
export type PaperPart = { text: string } | { text: string; word: WordId; blank: PaperBlank };

/** The paper's line cut into the text between words and the words themselves, each with its blank. */
export function paperParts(p: Paper): PaperPart[] {
  const out: PaperPart[] = [];
  let at = 0;
  p.tokens.forEach((tk, i) => {
    if (tk.start > at) out.push({ text: p.text.slice(at, tk.start) });
    out.push({ text: p.text.slice(tk.start, tk.end), word: tk.word, blank: p.blanks[i] });
    at = tk.end;
  });
  if (at < p.text.length) out.push({ text: p.text.slice(at) });
  return out;
}

/** The known words of a paper with their short glosses, each once, in line order. */
export function paperGlosses(course: Course, p: Paper): { word: WordId; text: string; gloss: string }[] {
  const seen = new Set<WordId>();
  return paperParts(p).flatMap((part) => {
    if (!("word" in part) || !part.blank.known || seen.has(part.word) || !course.words[part.word]) return [];
    seen.add(part.word);
    return [{ word: part.word, text: part.text, gloss: displayGloss(course.words[part.word]) }];
  });
}
