import { availableSceneIds, rankFor, type Course, type GameState } from "@silver-tongue/core";
import type { Text } from "./text";

export interface HudValues {
  day: number;
  slot: number;
  slots: number;
  currency: string;
  wallet: number;
  rank: number;
  rankLabel: string;
  parcel: boolean;
  rentLate: boolean;
  /** Days until rent is taken (at the end of every 7th day): 0 when that's tonight, or when it's late. */
  rentInDays: number;
  /** What to do next ("Next: Talk about food"), or undefined when there's no news to point at. */
  goal?: string;
  /** The time of day, "08:00" to "20:00" (see `clock`). */
  clock: string;
  /** The part of the day it is, with its icon ("🌅 morning" to "🌙 night"; see `dayPart`). */
  part: string;
  /** Where and when the story is set ("Suzhou, 1980"), when the setting says. */
  where?: string;
}

/** The waking day, in minutes: the slots share it evenly. */
const DAY_START = 8 * 60;
const DAY_LENGTH = 12 * 60;

/**
 * The time of day: each of the day's slots starts on the hour it gets of a 08:00-20:00 day, and a
 * scene moves the clock on a few minutes with each exchange. Before the first scene it's 08:00;
 * once every slot is used it's 20:00.
 */
export function clock(course: Course, state: GameState): string {
  const m = Math.floor(minutesOfDay(course, state));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function minutesOfDay(course: Course, state: GameState): number {
  const per = DAY_LENGTH / course.world.slotsPerDay;
  const run = state.run;
  return run ? DAY_START + (state.slot - 1) * per + 5 + run.exchange * 4 + run.misses : DAY_START + Math.min(state.slot, course.world.slotsPerDay) * per;
}

/** The parts of the day, each with the hour it starts and its icon. */
const DAY_PARTS: [string, number, string][] = [
  ["morning", 0, "🌅"],
  ["late-morning", 11, "☀️"],
  ["afternoon", 14, "🌤️"],
  ["evening", 17, "🌇"],
  ["night", 20, "🌙"],
];

/**
 * The part of the day by the clock, named rather than counted: with four slots, the day is morning,
 * late morning, afternoon and evening, and night once they're used. Its icon leads: "🌤️ afternoon".
 */
export function dayPart(course: Course, state: GameState, t: Text): string {
  const hour = minutesOfDay(course, state) / 60;
  const [part, , icon] = DAY_PARTS.filter(([, from]) => hour >= from).at(-1)!;
  return `${icon} ${t(`day-part-${part}`)}`;
}

/**
 * The next step of the story: bed once the day's time is gone, else the first new scene open now
 * (in the course's order), named with its place when that's elsewhere. Repeatable work is the
 * player's own choice, so it's never a goal; with only that left, there is none.
 */
export function nextGoal(course: Course, state: GameState, t: Text): string | undefined {
  if (state.run) return undefined;
  if (state.slot >= course.world.slotsPerDay) return t("hud-goal-sleep");
  const open = new Set(availableSceneIds(course, state));
  const scene = course.scenes.find((s) => open.has(s.id) && !s.repeatable);
  if (!scene) return undefined;
  const name = t(`scene-${scene.id}`);
  return t("hud-goal", { goal: scene.place === state.place ? name : `${name} · ${t(`place-${scene.place}`)}` });
}

export function hudValues(course: Course, state: GameState, t: Text, now: number): HudValues {
  const rank = rankFor(state.words, Object.keys(course.words), now);
  const goal = nextGoal(course, state, t);
  return {
    day: state.day,
    slot: state.slot,
    slots: course.world.slotsPerDay,
    currency: course.world.currency,
    wallet: state.wallet,
    rank,
    rankLabel: t(`rank-${rank}`),
    parcel: !!state.errand,
    rentLate: state.rentLate,
    rentInDays: state.rentLate ? 0 : (7 - (state.day % 7)) % 7,
    ...(goal ? { goal } : {}),
    clock: clock(course, state),
    part: dayPart(course, state, t),
    ...(t.has("setting-where") ? { where: t("setting-where") } : {}),
  };
}
