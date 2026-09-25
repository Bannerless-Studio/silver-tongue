import type { Course, GameEvent, GameState, Scene, WalletReason } from "./types";

export function isAvailable(scene: Scene, state: GameState): boolean {
  if (!scene.repeatable && (state.scenesDone[scene.id] ?? 0) > 0) return false;
  if (!scene.after.every((id) => (state.scenesDone[id] ?? 0) > 0)) return false;
  const trust = scene.requires.trust ?? {};
  return Object.entries(trust).every(([npc, min]) => (state.trust[npc] ?? 0) >= min);
}

export function availableSceneIds(course: Course, state: GameState): string[] {
  return course.scenes.filter((s) => isAvailable(s, state)).map((s) => s.id);
}

/** The wallet never goes below zero: there is no debt. */
export function changeWallet(state: GameState, delta: number, reason: WalletReason): GameEvent[] {
  const next = Math.max(0, state.wallet + delta);
  const actual = next - state.wallet;
  state.wallet = next;
  return actual === 0 ? [] : [{ type: "walletChanged", wallet: next, delta: actual, reason }];
}

export function addTrust(state: GameState, npc: string, amount: number): GameEvent[] {
  if (amount <= 0) return [];
  state.trust[npc] = (state.trust[npc] ?? 0) + amount;
  return [{ type: "trustChanged", npc, trust: state.trust[npc] }];
}

/**
 * Food daily; rent every 7th day. Short on rent: the landlord waits and tries again next night.
 * Late rent never stacks: paying once clears it, however many weeks passed. There is no debt
 * by design (spec: "rent pressure is soft").
 */
export function endDay(course: Course, state: GameState): GameEvent[] {
  const { foodPerDay, rentPerWeek } = course.world;
  const events: GameEvent[] = [{ type: "dayEnded", day: state.day }];
  events.push(...changeWallet(state, -foodPerDay, "food"));
  if (state.day % 7 === 0 || state.rentLate) {
    if (state.wallet >= rentPerWeek) {
      events.push(...changeWallet(state, -rentPerWeek, "rent"));
      state.rentLate = false;
    } else {
      state.rentLate = true;
    }
  }
  state.day += 1;
  state.slot = 0;
  return events;
}

export function newGame(course: Course): GameState {
  return {
    v: 1,
    course: course.id,
    day: 1,
    slot: 0,
    wallet: course.world.startWallet,
    rentLate: false,
    place: course.world.start,
    trust: {},
    words: {},
    scenesDone: {},
    run: null,
    notes: { ready: [], read: [] },
    log: [],
  };
}
