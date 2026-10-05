// Scribe mode (lab only): the first conversations read in Latin letters and answered by typing meanings.
// Whether it is on, and the little state it keeps: per exchange (misses, help) and per course (how many it has begun).
import type { Course } from "@silver-tongue/core";
import { deskPapers, isScribeScene, scribeCountKey } from "@silver-tongue/view";
import { labMode } from "@silver-tongue/web-common";

const inLab = (): boolean => typeof document !== "undefined" && labMode();

/**
 * Whether the conversation on stage is played in scribe mode: the lab page, a course read by romanising (the one with the
 * desk, see deskPapers), and one of the first scenes (SCRIBE_SCENES). Anywhere else the page is exactly as it was.
 * `lab`: the lab page flag (the page's meta by default; off where there is no page).
 */
export function scribeOn(view: { scene?: string }, course: Course, lab: boolean = inLab()): boolean {
  return lab && deskPapers(course).length > 0 && isScribeScene(view.scene);
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
}

const rounds = new Map<string, Round>();
const listeners = new Set<() => void>();

const readCount = (course: string): number => {
  try {
    const n = Number(localStorage.getItem(scribeCountKey(course)));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};
const writeCount = (course: string, n: number) => {
  try {
    localStorage.setItem(scribeCountKey(course), String(n));
  } catch {
    // private window: the arc starts over next time
  }
};

/** The round of an exchange on this course, begun (and counted) the first time it is asked for. */
export function scribeRound(course: string, exchange: string | number): Round {
  const key = `${course}:${exchange}`;
  let r = rounds.get(key);
  if (!r) {
    const index = readCount(course);
    writeCount(course, index + 1);
    r = { index, solved: false, misses: 0, help: 0, rMisses: 0, rHelp: false };
    rounds.set(key, r);
  }
  return r;
}

/** Changes a round and tells whoever draws it. */
export function updateRound(course: string, exchange: string | number, change: Partial<Round>) {
  const key = `${course}:${exchange}`;
  rounds.set(key, { ...scribeRound(course, exchange), ...change });
  listeners.forEach((l) => l());
}

export const subscribeRounds = (l: () => void): (() => void) => (listeners.add(l), () => void listeners.delete(l));

/** For tests: forget every round. */
export const resetRounds = () => rounds.clear();
