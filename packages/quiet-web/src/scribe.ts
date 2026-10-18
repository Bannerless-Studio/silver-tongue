// Scribe mode (lab only): the first conversations read in Latin letters and answered by typing meanings.
// Whether it is on, and the little state it keeps: per exchange (misses, help) and per course (how many it has begun).
import { emptyOpeningChoices, parseOpeningChoices, type OpeningChoices } from "./door-choices";
import { pageStorage } from "./storage";
import type { Course } from "@silver-tongue/core";
import { bestMeanings, deskPapers, isScribeScene, scribeCountKey } from "@silver-tongue/view";
import { labMode } from "@silver-tongue/web-common";

const inLab = (): boolean => typeof document !== "undefined" && labMode();

export { doorExperimentOn } from "./door-choices";

/**
 * Whether the conversation on stage is played in scribe mode: the lab page, a course read by romanising (the one with the
 * desk, see deskPapers), and one of the course’s scribe scenes. Anywhere else the page is exactly as it was.
 * `lab`: the lab page flag (the page's meta by default; off where there is no page).
 */
export function scribeOn(view: { scene?: string }, course: Course, lab: boolean = inLab()): boolean {
  return lab && deskPapers(course).length > 0 && isScribeScene(course, view.scene);
}

/** What one exchange's two fields have seen so far. */
export interface Round {
  /** scribe exchanges the course had begun before this one (0 for the very first) */
  index: number;
  /** their line has been typed right */
  solved: boolean;
  /** wrong tries at their line, and the help given for it: 0 none, 1 per-word glosses, 2 the full meaning */
  misses: number;
  help: 0 | 1 | 2;
  /** the same for the reply: wrong tries, and whether each slip's meaning is shown */
  rMisses: number;
  rHelp: boolean;
  /** Option indexes that require the player to disambiguate; isolated per exchange. */
  ties: number[];
}

/** Rounds belong to the Quiet (one game on screen): a new game or a lab jump starts with none. */
const rounds = new WeakMap<object, Map<string, Round>>();
const roundsOf = (owner: object): Map<string, Round> => {
  let m = rounds.get(owner);
  if (!m) rounds.set(owner, (m = new Map()));
  return m;
};
const listeners = new Set<() => void>();

const readCount = (course: string): number => {
  try {
    const n = Number(pageStorage().getItem(scribeCountKey(course)));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};
/** Sets how many scribe exchanges a course has begun (a lab jump to exchange k: k-1 are behind it). */
export const writeCount = (course: string, n: number) => {
  try {
    pageStorage().setItem(scribeCountKey(course), String(n));
  } catch {
    // private window: the arc starts over next time
  }
};

/** The round of an exchange of the game `owner` (its Quiet) plays on this course, begun (and counted) the first time it is asked for. */
export function scribeRound(owner: object, course: string, exchange: string | number): Round {
  const key = `${course}:${exchange}`;
  const all = roundsOf(owner);
  let r = all.get(key);
  if (!r) {
    const index = readCount(course);
    writeCount(course, index + 1);
    r = { index, solved: false, misses: 0, help: 0, rMisses: 0, rHelp: false, ties: [] };
    all.set(key, r);
  }
  return r;
}

/** Changes a round and tells whoever draws it. */
export function updateRound(owner: object, course: string, exchange: string | number, change: Partial<Round>) {
  const key = `${course}:${exchange}`;
  roundsOf(owner).set(key, { ...scribeRound(owner, course, exchange), ...change });
  listeners.forEach((l) => l());
}

export const subscribeRounds = (l: () => void): (() => void) => (listeners.add(l), () => void listeners.delete(l));

/** The words new on an exchange's line or reply, worked out when first asked for and kept: a word does not turn bare while its own exchange is still on stage. */
const freshSets = new WeakMap<object, Map<string, Set<string>>>();
export function freshOnce(owner: object, key: string, compute: () => Set<string>): Set<string> {
  let m = freshSets.get(owner);
  if (!m) freshSets.set(owner, (m = new Map()));
  let f = m.get(key);
  if (!f) m.set(key, (f = compute()));
  return f;
}

/** Durable opening decisions, isolated per saved lab game. Core retains only five recent talks. */
export interface OpeningStore {
  load(): OpeningChoices;
  save(choices: OpeningChoices): void;
}
export const openingKey = (course: string, game: string): string => `silver-tongue:lab:opening-choices:v1:${course}:${game}`;
export function openingStore(course: Course, game: string): OpeningStore {
  const key = openingKey(course.id, game);
  let fallback = emptyOpeningChoices();
  return {
    load() {
      try { return parseOpeningChoices(JSON.parse(pageStorage().getItem(key) ?? "null"), course); }
      catch { return parseOpeningChoices(fallback, course); }
    },
    save(choices) {
      fallback = parseOpeningChoices(choices, course);
      try { pageStorage().setItem(key, JSON.stringify(fallback)); } catch { /* Keep this visit playable. */ }
    },
  };
}

/** A typed reply either fails, says one slip, or asks for an explicit choice among tied slips. */
export function resolveScribeReply(typed: string, slips: readonly { meaning: string; accepts?: readonly string[] }[]):
  { kind: "miss" } | { kind: "say"; index: number } | { kind: "choose"; indices: number[] } {
  const indices = bestMeanings(typed, slips);
  return !indices.length ? { kind: "miss" } : indices.length === 1 ? { kind: "say", index: indices[0] } : { kind: "choose", indices };
}
