import type { Course, GameState } from "./types";

export const SAVE_VERSION = 1;

export type ParseResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Strict: anything unexpected is rejected with a reason, never half-loaded. */
export function parseSave(raw: string, course: Course): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (!isObj(data)) return { ok: false, reason: "not-object" };
  if (data.v !== SAVE_VERSION) return { ok: false, reason: "version" };
  if (data.course !== course.id) return { ok: false, reason: "other-course" };
  for (const k of ["day", "slot", "wallet"]) {
    if (typeof data[k] !== "number") return { ok: false, reason: `bad-${k}` };
  }
  if (typeof data.rentLate !== "boolean") return { ok: false, reason: "bad-rentLate" };
  if (typeof data.place !== "string" || !course.world.places[data.place]) return { ok: false, reason: "bad-place" };
  for (const k of ["trust", "words", "scenesDone"]) {
    if (!isObj(data[k])) return { ok: false, reason: `bad-${k}` };
  }
  if (data.run !== null && !isObj(data.run)) return { ok: false, reason: "bad-run" };
  return { ok: true, state: data as unknown as GameState };
}
