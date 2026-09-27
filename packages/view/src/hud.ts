import { rankFor, type Course, type GameState } from "@silver-tongue/core";
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
}

export function hudValues(course: Course, state: GameState, t: Text, now: number): HudValues {
  const rank = rankFor(state.words, Object.keys(course.words), now);
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
  };
}
