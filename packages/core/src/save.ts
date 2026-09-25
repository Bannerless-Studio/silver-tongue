import { comboKey } from "./combo";
import { altIndex, tilePieces } from "./dialogue";
import { cleanName } from "./player";
import { PLAYER_MARK, type Course, type GameState, type SceneRun } from "./types";

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
  if (x.first !== undefined && !(isObj(x.first) && typeof x.first.line === "string" && typeof x.first.place === "string")) return false;
  return ["right", "wrong", "streak", "helps", "firstSeen", "lastSeen"].every((k) => isCount(x[k]));
}

function isRunShape(x: unknown): x is SceneRun {
  if (!isObj(x) || typeof x.scene !== "string" || !isObj(x.combo) || !allValues(x.combo, (v) => typeof v === "string"))
    return false;
  if (!["pick", "tiles", "type"].includes(x.mode as string) || !isStrings(x.options) || !isStrings(x.tiles)) return false;
  return ["exchange", "misses", "earned", "mixups"].every((k) => isCount(x[k]));
}

const INPUT_TYPES = new Set(["goTo", "startScene", "reply", "replyTiles", "helpWord", "visitMentor", "setName", "sleep"]);

function isLogEntry(x: unknown): boolean {
  return isObj(x) && isCount(x.t) && isCount(x.day) && isCount(x.slot) && isObj(x.input) && INPUT_TYPES.has(x.input.type as string);
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
  if (run.mode === "pick") {
    return run.options.every((k) => {
      const n = altIndex(k);
      return n === undefined ? !!ex.variants[k] : !!v.alts?.[n];
    });
  }
  return tilesCover(run.tiles, tilePieces(v.reply));
}

/** Saves from before the player's name was a tile have only the word tiles: add the name tile back. */
function addNameTiles(run: SceneRun, course: Course): void {
  if (run.mode !== "tiles") return;
  const v = course.scenes.find((s) => s.id === run.scene)?.exchanges[run.exchange]?.variants[comboKey(run.combo)];
  if (!v) return;
  const missing = tilePieces(v.reply).filter((p) => p === PLAYER_MARK).length - run.tiles.filter((t) => t === PLAYER_MARK).length;
  for (let i = 0; i < missing; i++) run.tiles.push(PLAYER_MARK);
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
  if (data.player !== undefined && (typeof data.player !== "string" || cleanName(data.player) !== data.player)) {
    return { ok: false, reason: "bad-player" };
  }
  // notes and log came later: a save without them gets empty ones (but null is malformed).
  if (!("notes" in data)) data.notes = { ready: [], read: [] };
  if (!("log" in data)) data.log = [];
  if (!isObj(data.notes) || !isStrings(data.notes.ready) || !isStrings(data.notes.read)) return { ok: false, reason: "bad-notes" };
  if (!Array.isArray(data.log) || !data.log.every(isLogEntry)) return { ok: false, reason: "bad-log" };
  // Notes the course no longer has are dropped, like a scene it no longer has.
  const noteIds = new Set(course.notes.map((n) => n.id));
  const keep = (ids: string[]) => [...new Set(ids)].filter((id) => noteIds.has(id));
  data.notes = { ready: keep(data.notes.ready), read: keep(data.notes.read) };
  const state = data as unknown as GameState;
  if (state.run) addNameTiles(state.run, course);
  if (state.run && !runFits(state.run, course)) state.run = null;
  return { ok: true, state };
}
