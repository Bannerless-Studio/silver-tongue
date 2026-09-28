import { availableSceneIds, canSleep, mentorAvailable, moneyBlocked, placeKnown, sceneCost, type Course, type GameState, type Input } from "@silver-tongue/core";
import type { Text } from "./text";

/** Scenes, exits and the mentor's visit before sleep; the content checker keeps places within it. */
export const MAX_PLACE_ITEMS = 7;

export type MenuItem =
  // `disabled`, when set, is why the action can't be taken right now: still offered (so the
  // rejection message still shows), but a front end should show it dimmed with the reason inline.
  | { kind: "talk"; label: string; input: Input; npc: string; scene: string; disabled?: string }
  | { kind: "mentor"; label: string; input: Input; npc: string; disabled?: string }
  | { kind: "go"; label: string; input: Input; place: string }
  | { kind: "sleep"; label: string; input: Input };

/** True once `label` already names the npc, so a "Talk to <npc>:" lead-in would just repeat it. */
function namesNpc(label: string, npc: string): boolean {
  return label.toLowerCase().includes(npc.toLowerCase());
}

/**
 * Every talk/mentor action costs exactly one of the day's slots; that's the norm, so it's never
 * shown. A yuan cost is the only thing that varies here, so it's the only thing worth calling out.
 */
function costSuffix(t: Text, cost: number, currency: string): string {
  return cost > 0 ? t("menu-cost-money", { currency, cost }) : "";
}

/** What the player can do here: talk, visit the mentor, go somewhere, and sleep (last, once it's time and there's a bed). */
export function placeMenu(course: Course, state: GameState, t: Text): MenuItem[] {
  const npcName = (npc: string) => t(`npc-${npc}`);
  const items: MenuItem[] = [];
  // Every talk/mentor action costs a slot; with none left, offering them just invites the rejection.
  const noSlots = state.slot >= course.world.slotsPerDay;
  const disabled = noSlots ? t("menu-no-time") : undefined;
  const alone = Object.values(course.world.npcs).filter((n) => n.place === state.place).length <= 1;
  for (const id of availableSceneIds(course, state)) {
    const scene = course.scenes.find((x) => x.id === id)!;
    if (scene.place !== state.place) continue;
    const npc = npcName(scene.npc);
    const sceneName = t(`scene-${id}`);
    // With one person here, naming them on every item says nothing the place doesn't.
    const label = alone || namesNpc(sceneName, npc) ? sceneName : t("menu-talk", { npc, scene: sceneName });
    items.push({
      kind: "talk",
      label: label + costSuffix(t, sceneCost(scene), course.world.currency),
      input: { type: "startScene", scene: id },
      npc: scene.npc,
      scene: id,
      disabled,
    });
  }
  // Offered only when there is something to explain, so a slot is never spent on nothing.
  if (mentorAvailable(course, state) && state.notes.ready.length) {
    const npc = course.world.mentor!.npc;
    items.push({ kind: "mentor", label: t("menu-mentor", { npc: npcName(npc) }), input: { type: "visitMentor" }, npc, disabled });
  }
  // A place stays off the menu until the scenes that reveal it are done.
  for (const p of course.world.places[state.place].links) {
    if (!placeKnown(course, state, p)) continue;
    items.push({ kind: "go", label: t("menu-go", { place: t(`place-${p}`) }), input: { type: "goTo", place: p }, place: p });
  }
  // Sleep is offered only where the core allows it (home, or the start before there is a home), and
  // only once it's what's left to do: the day's time is gone, or no scene or visit is open anywhere.
  const nothingLeft = !availableSceneIds(course, state).length && !(mentorAvailable(course, state) && state.notes.ready.length);
  const sleep: MenuItem[] =
    canSleep(course, state) && (noSlots || nothingLeft) ? [{ kind: "sleep", label: t("menu-sleep"), input: { type: "sleep" } }] : [];
  return [...items.slice(0, MAX_PLACE_ITEMS), ...sleep];
}

/** Scenes here that wait only for money: shown, not offered, so an empty shop says why. */
export function waitingForMoney(course: Course, state: GameState, t: Text): string[] {
  return course.scenes
    .filter((x) => x.place === state.place && moneyBlocked(x, state))
    .map((x) => t("menu-needs-money", { npc: t(`npc-${x.npc}`), scene: t(`scene-${x.id}`), currency: course.world.currency, cost: sceneCost(x) }));
}
