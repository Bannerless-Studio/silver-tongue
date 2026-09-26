import { availableSceneIds, mentorAvailable, moneyBlocked, sceneCost, type Course, type GameState, type Input } from "@silver-tongue/core";
import type { Text } from "./text";

/** Scenes, exits and the mentor's visit before sleep; the content checker keeps places within it. */
export const MAX_PLACE_ITEMS = 7;

export type MenuItem =
  | { kind: "talk"; label: string; input: Input; npc: string; scene: string }
  | { kind: "mentor"; label: string; input: Input; npc: string }
  | { kind: "go"; label: string; input: Input; place: string }
  | { kind: "sleep"; label: string; input: Input };

/** What the player can do here: talk, visit the mentor, go somewhere, sleep (always last). */
export function placeMenu(course: Course, state: GameState, t: Text): MenuItem[] {
  const npcName = (npc: string) => t(`npc-${npc}`);
  const items: MenuItem[] = [];
  for (const id of availableSceneIds(course, state)) {
    const scene = course.scenes.find((x) => x.id === id)!;
    if (scene.place !== state.place) continue;
    items.push({
      kind: "talk",
      label: t("menu-talk", { npc: npcName(scene.npc), scene: t(`scene-${id}`) }) + t("cost-slot"),
      input: { type: "startScene", scene: id },
      npc: scene.npc,
      scene: id,
    });
  }
  // Offered only when there is something to explain, so a slot is never spent on nothing.
  if (mentorAvailable(course, state) && state.notes.ready.length) {
    const npc = course.world.mentor!.npc;
    items.push({ kind: "mentor", label: t("menu-mentor", { npc: npcName(npc) }) + t("cost-slot"), input: { type: "visitMentor" }, npc });
  }
  for (const p of course.world.places[state.place].links) {
    items.push({ kind: "go", label: t("menu-go", { place: t(`place-${p}`) }), input: { type: "goTo", place: p }, place: p });
  }
  return [...items.slice(0, MAX_PLACE_ITEMS), { kind: "sleep", label: t("menu-sleep"), input: { type: "sleep" } }];
}

/** Scenes here that wait only for money: shown, not offered, so an empty shop says why. */
export function waitingForMoney(course: Course, state: GameState, t: Text): string[] {
  return course.scenes
    .filter((x) => x.place === state.place && moneyBlocked(x, state))
    .map((x) => t("menu-needs-money", { npc: t(`npc-${x.npc}`), scene: t(`scene-${x.id}`), currency: course.world.currency, cost: sceneCost(x) }));
}
