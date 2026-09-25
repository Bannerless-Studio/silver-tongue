import type { ReplyMode, WordId, WordRecord, WordState } from "./types";

export const DAY_MS = 86_400_000;
export const KNOWN_STREAK = 3;
export const MAX_INTERVAL_DAYS = 60;
/** Share of course words known needed for each rank (Pidgin … Silver Tongue). */
export const RANK_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.85];

export function decayIntervalMs(streak: number): number {
  return Math.min(MAX_INTERVAL_DAYS, 2 ** (streak - 2)) * DAY_MS;
}

export function wordState(rec: WordRecord | undefined, now: number): WordState {
  if (!rec) return "unseen";
  if (rec.lapsed) return "shaky";
  if (rec.streak >= KNOWN_STREAK) return now - rec.lastSeen > decayIntervalMs(rec.streak) ? "shaky" : "known";
  return "met";
}

function base(rec: WordRecord | undefined, now: number): WordRecord {
  return rec
    ? { ...rec }
    : { right: 0, wrong: 0, streak: 0, helps: 0, lapsed: false, firstSeen: now, lastSeen: now };
}

/** Seeing a word that has decayed doesn't revive it: it stays shaky until it is answered right. */
export function recordSeen(rec: WordRecord | undefined, now: number): WordRecord {
  const r = base(rec, now);
  if (wordState(rec, now) === "shaky") r.lapsed = true;
  r.lastSeen = now;
  return r;
}

export function recordRight(rec: WordRecord | undefined, now: number): WordRecord {
  const r = recordSeen(rec, now);
  r.right += 1;
  r.streak += 1;
  r.lapsed = false;
  return r;
}

export function recordWrong(rec: WordRecord | undefined, now: number): WordRecord {
  const r = recordSeen(rec, now);
  r.wrong += 1;
  r.streak = 0;
  r.lapsed = true;
  return r;
}

export function recordHelp(rec: WordRecord | undefined, now: number): WordRecord {
  const r = recordSeen(rec, now);
  r.helps += 1;
  r.streak = 0;
  r.lapsed = true;
  return r;
}

const MODE_RANK: Record<WordState, number> = { unseen: 0, met: 0, shaky: 1, known: 2 };

/** The weakest hinge word decides: met -> pick, shaky -> tiles, known -> type (tiles without typing). */
export function replyModeFor(states: WordState[], typing: boolean): ReplyMode {
  if (states.length === 0) return "pick";
  const r = Math.min(...states.map((s) => MODE_RANK[s]));
  if (r === 0) return "pick";
  if (r === 1) return "tiles";
  return typing ? "type" : "tiles";
}

/**
 * Shaky first (hidden repetition), then unseen (so every value of a group gets introduced),
 * then met, then known; ties broken by rng. A candidate counts as its weakest word.
 */
export function pickPreferred<T>(
  candidates: T[],
  wordsOf: (c: T) => WordId[],
  records: Record<WordId, WordRecord>,
  now: number,
  rng: () => number,
): T {
  const prio = (c: T) =>
    Math.min(
      3,
      ...wordsOf(c).map((w) => {
        const s = wordState(records[w], now);
        return s === "shaky" ? 0 : s === "unseen" ? 1 : s === "met" ? 2 : 3;
      }),
    );
  if (candidates.length === 0) throw new Error("pickPreferred: no candidates");
  const best = Math.min(...candidates.map(prio));
  const pool = candidates.filter((c) => prio(c) === best);
  return pool[Math.floor(rng() * pool.length)];
}

export function rankFor(records: Record<WordId, WordRecord>, wordIds: WordId[], now: number): number {
  if (wordIds.length === 0) return 0;
  const known = wordIds.filter((w) => wordState(records[w], now) === "known").length;
  const share = known / wordIds.length;
  let rank = 0;
  RANK_THRESHOLDS.forEach((t, i) => {
    if (share >= t) rank = i;
  });
  return rank;
}
