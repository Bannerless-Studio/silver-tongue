import { wordState, type Course, type GameState, type RenderedLine, type WordId, type WordState } from "@silver-tongue/core";
import { displayGloss } from "./help";
import { dayPart, type DayPart } from "./hud";
import { bookOn } from "./course-extra";
import { rubyRow, type RubySetting, type RubySpan } from "./ruby";
import type { Text } from "./text";

/**
 * Surprisal rules for the quiet terminal page: expected state is left out, deviations are shown.
 * Spec: docs/superpowers/specs/2026-09-28-quiet-terminal-design.md.
 */

export interface RentAlert {
  amount: number;
  /** nights until the sleep that charges rent: 0 means tonight */
  dueInDays: number;
  wallet: number;
  late: boolean;
}
export interface AnchorRow {
  place: string;
  day: number;
  /** the part of the day */
  part: DayPart;
  /** only when rent is a risk worth reading; absent on an ordinary day */
  rent?: RentAlert;
}

/** Nights until rent is charged: on the sleep that ends a day divisible by 7 (core life.ts endDay). */
export function rentDueInDays(day: number): number {
  return day % 7 === 0 ? 0 : 7 - (day % 7);
}

/** Days of food rent must leave in the wallet on the last day before it is due, or rent shows (backstop). */
export const RENT_FOOD_DAYS = 3;

/**
 * The one line always on screen: where and when. Rent joins it only when late, when the wallet
 * won't cover it at the pace food eats it (pace), or when, on the last day before it is due, paying
 * it would leave less than RENT_FOOD_DAYS of food (backstop). Day 1 never shows it: the opening prose says it.
 * A course with the Book shows it only once the player has done paid work: before there is a way to earn,
 * a deadline is a worry with nothing to do about it (Status still has it).
 */
export function anchorRow(course: Course, state: GameState, t: Text): AnchorRow {
  const { foodPerDay, rentPerWeek } = course.world;
  const row: AnchorRow = { place: t(`place-${state.place}`), day: state.day, part: dayPart(course, state) };
  const dueInDays = rentDueInDays(state.day);
  // endDay charges food before rent on the same sleep, so the due night's food counts too.
  const projected = state.wallet - foodPerDay * (dueInDays + 1);
  const pace = projected < rentPerWeek;
  const backstop = dueInDays <= 1 && state.wallet < rentPerWeek + foodPerDay * RENT_FOOD_DAYS;
  const earning = !bookOn(course) || course.scenes.some((s) => state.scenesDone[s.id] && s.exchanges.some((ex) => ex.pay > 0));
  const show = state.rentLate || (state.day > 1 && earning && (pace || backstop));
  if (show) row.rent = { amount: rentPerWeek, dueInDays: state.rentLate ? 0 : dueInDays, wallet: state.wallet, late: state.rentLate };
  return row;
}

export type GlossPolicy = "gloss" | "mark" | "bare";

/**
 * How a word in a line is drawn: only an unseen word glosses itself; a shaky one is marked; the rest
 * are bare. `book` (a course with the Book, see bookOn): every word is bare, its reading under it
 * (quietRuby) being the one mark.
 */
export function glossPolicy(state: WordState, book = false): GlossPolicy {
  if (book) return "bare";
  if (state === "unseen") return "gloss";
  if (state === "shaky") return "mark";
  return "bare";
}

export type ShakyWhy = "missed" | "helped" | "decayed";
export interface ShakyWord {
  word: WordId;
  text: string;
  reading: string;
  gloss: string;
  why: ShakyWhy;
  /** times missed, with why "missed" */
  count?: number;
}
export interface NotebookDefault {
  shaky: ShakyWord[];
  counts: Record<WordState, number>;
}

/** Why a shaky word is shaky: missed (more misses than helps), helped, or just not seen for too long. */
function shakyWhy(rec: GameState["words"][string]): { why: ShakyWhy; count?: number } {
  if (rec.wrong > 0 && rec.wrong >= rec.helps) return { why: "missed", count: rec.wrong };
  if (rec.helps > 0) return { why: "helped" };
  return { why: "decayed" };
}

/** The notebook's first view: the words that need work and why, shakiest first, and a count per state. */
export function notebookDefault(course: Course, state: GameState, now: number): NotebookDefault {
  const counts: Record<WordState, number> = { unseen: 0, met: 0, shaky: 0, known: 0 };
  const shaky: (ShakyWord & { lastSeen: number; wrong: number })[] = [];
  for (const id of Object.keys(course.words)) {
    const rec = state.words[id];
    const s = wordState(rec, now);
    counts[s]++;
    if (s !== "shaky") continue;
    const w = course.words[id];
    shaky.push({ word: id, text: w.w, reading: w.readings?.at(-1) ?? "", gloss: displayGloss(w), ...shakyWhy(rec), lastSeen: rec.lastSeen, wrong: rec.wrong });
  }
  shaky.sort((a, b) => b.wrong - a.wrong || b.lastSeen - a.lastSeen);
  return { shaky: shaky.map(({ lastSeen: _l, wrong: _w, ...w }) => w), counts };
}

export interface ReviewTell {
  repeat: boolean;
  /** the most a run pays: every exchange right first time */
  pays?: number;
}

/**
 * A repeat shift is where review hides; the only tell is that it says so and what it pays.
 * With `state`, a repeatable scene counts as a repeat only once it has been done before.
 */
export function reviewTell(course: Course, sceneId: string, state?: GameState): ReviewTell {
  const scene = course.scenes.find((s) => s.id === sceneId);
  if (!scene?.repeatable) return { repeat: false };
  if (state && !(state.scenesDone[sceneId] ?? 0)) return { repeat: false };
  const pays = scene.exchanges.reduce((sum, ex) => sum + ex.pay, 0);
  return pays > 0 ? { repeat: true, pays } : { repeat: true };
}

/**
 * The readings written under a line on the quiet page: rubyRow as the ruby setting has it. Only a course with the Book has readings, and it has no
 * first-time gloss rows (see freshMarks), so nothing is said twice.
 */
export function quietRuby(course: Course, line: RenderedLine, words: GameState["words"], now: number, ruby: RubySetting): RubySpan[] {
  return rubyRow(course, line, words, now, ruby);
}

/** A transcript line as speakerNamed sees it: who said it, and which scene run it was said in. */
export interface Spoken {
  /** an NPC id, "player" for the player's own reply, absent for narration */
  speaker?: string;
  /** the scene run the line was said in (any id unique to that run); absent outside a scene */
  run?: number;
}

/**
 * Whether each line's speaker label is shown. A course with the Book names an NPC once: on the
 * scene's first NPC line and when the NPC speaking changes. The player's own replies and narration
 * between don't count as a change. The player's lines, lines outside a scene, and every line of a
 * course without the Book keep their label.
 */
export function speakerNamed(course: Course, lines: readonly Spoken[]): boolean[] {
  if (!bookOn(course)) return lines.map(() => true);
  let prev: Spoken | undefined;
  return lines.map((l) => {
    if (!l.speaker || l.speaker === "player") return true;
    const named = l.run === undefined || !prev || prev.run !== l.run || prev.speaker !== l.speaker;
    prev = l;
    return named;
  });
}
