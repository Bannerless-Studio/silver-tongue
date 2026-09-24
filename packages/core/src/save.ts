import { comboKey } from "./combo";
import { tilePieces } from "./dialogue";
import type { Course, GameState, SceneRun } from "./types";

export const SAVE_VERSION = 1;

export type ParseResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === "string");
const allValues = (o: Record<string, unknown>, ok: (v: unknown) => boolean) => Object.values(o).every(ok);

function isWordRecord(x: unknown): boolean {
  if (!isObj(x) || typeof x.lapsed !== "boolean") return false;
  return ["right", "wrong", "streak", "helps", "firstSeen", "lastSeen"].every((k) => isCount(x[k]));
}

function isRunShape(x: unknown): x is SceneRun {
  if (!isObj(x) || typeof x.scene !== "string" || !isObj(x.combo) || !allValues(x.combo, (v) => typeof v === "string"))
    return false;
  if (!["pick", "tiles", "type"].includes(x.mode as string) || !isStrings(x.options) || !isStrings(x.tiles)) return false;
  return ["exchange", "misses", "earned", "mixups"].every((k) => isCount(x[k]));
}

/** Every piece of the reply is among the tiles, repeats counted. */
function tilesCover(tiles: string[], pieces: string[]): boolean {
  const left = [...tiles];
  return pieces.every((p) => {
    const i = left.indexOf(p);
    return i >= 0 && left.splice(i, 1).length === 1;
  });
}

/** A run fits the course if its scene, exchange and slot combination still exist and its reply can still be given. */
function runFits(run: SceneRun, course: Course): boolean {
  const ex = course.scenes.find((s) => s.id === run.scene)?.exchanges[run.exchange];
  const v = ex?.variants[comboKey(run.combo)];
  if (!ex || !v) return false;
  if (run.mode === "pick") return run.options.every((k) => !!ex.variants[k]);
  return tilesCover(run.tiles, tilePieces(v.reply));
}

/**
 * Strict: anything malformed is rejected with a reason, never half-loaded.
 * One exception: a scene in progress that the course no longer has (after a content update)
 * is dropped, so the player lands outside the scene instead of being stuck in it.
 */
export function parseSave(raw: string, course: Course): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (!isObj(data)) return { ok: false, reason: "not-object" };
  if (typeof data.v === "number" && data.v > SAVE_VERSION) return { ok: false, reason: "newer-version" };
  if (data.v !== SAVE_VERSION) return { ok: false, reason: "version" };
  if (data.course !== course.id) return { ok: false, reason: "other-course" };
  if (!isCount(data.day)) return { ok: false, reason: "bad-day" };
  if (!isCount(data.slot) || data.slot > course.world.slotsPerDay) return { ok: false, reason: "bad-slot" };
  if (!isCount(data.wallet)) return { ok: false, reason: "bad-wallet" };
  if (typeof data.rentLate !== "boolean") return { ok: false, reason: "bad-rentLate" };
  if (typeof data.place !== "string" || !course.world.places[data.place]) return { ok: false, reason: "bad-place" };
  if (!isObj(data.trust) || !allValues(data.trust, isCount)) return { ok: false, reason: "bad-trust" };
  if (!isObj(data.scenesDone) || !allValues(data.scenesDone, isCount)) return { ok: false, reason: "bad-scenesDone" };
  if (!isObj(data.words) || !allValues(data.words, isWordRecord)) return { ok: false, reason: "bad-words" };
  if (data.run !== null && !isRunShape(data.run)) return { ok: false, reason: "bad-run" };
  const state = data as unknown as GameState;
  if (state.run && !runFits(state.run, course)) state.run = null;
  return { ok: true, state };
}
