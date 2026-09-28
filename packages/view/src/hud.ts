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
  };
}
