import { availableSceneIds, canSleep, hasHome, mentorAvailable, moneyBlocked, placeKnown, sceneCost, type Course, type GameState, type Input } from "@silver-tongue/core";
import { npcLabel } from "./person";
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

/** Every conversation, mentor visit, shift and purchase spends one part of the day. */
export function slotActionLabel(t: Text, label: string, cost: number, currency: string): string {
  const money = cost > 0 ? t("menu-cost-money", { currency, cost }) : "";
  return label + money + t("menu-cost-time");
}

/** Why talk actions disappear from a page that hides disabled menu items, including at home. */
export function menuDirection(course: Course, state: GameState, t: Text): string[] {
  return state.slot >= course.world.slotsPerDay ? [t("menu-day-used")] : [];
}

/**
 * What the player can do here: talk, visit the mentor, go somewhere, and sleep (last, once it's time and there's a bed).
 * `placeName` names a place as the player knows it (default: its plain name). A way out reads `place-<id>-go`
 * ("Go outside") when the course words it from what the player has seen, else "Go to <place>".
 */
export function placeMenu(course: Course, state: GameState, t: Text, placeName = (p: string) => t(`place-${p}`)): MenuItem[] {
  const npcName = (npc: string) => npcLabel(course, state, t, npc);
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
      label: slotActionLabel(t, label, sceneCost(scene), course.world.currency),
      input: { type: "startScene", scene: id },
      npc: scene.npc,
      scene: id,
      disabled,
    });
  }
  // Offered only when there is something to explain, so a slot is never spent on nothing.
  if (mentorAvailable(course, state) && state.notes.ready.length) {
    const npc = course.world.mentor!.npc;
    items.push({ kind: "mentor", label: slotActionLabel(t, t("menu-mentor", { npc: npcName(npc) }), 0, course.world.currency), input: { type: "visitMentor" }, npc, disabled });
  }
  // A place stays off the menu until the scenes that reveal it are done.
  for (const p of course.world.places[state.place].links) {
    if (!placeKnown(course, state, p)) continue;
    items.push({ kind: "go", label: t.has(`place-${p}-go`) ? t(`place-${p}-go`) : t("menu-go", { place: placeName(p) }), input: { type: "goTo", place: p }, place: p });
  }
  // Sleep is offered only where the core allows it (home, or the start before there is a home), and
  // only once it's what's left to do.
  const sleep: MenuItem[] =
    canSleep(course, state) && bedtime(course, state) ? [{ kind: "sleep", label: t("menu-sleep"), input: { type: "sleep" } }] : [];
  return [...items.slice(0, MAX_PLACE_ITEMS), ...sleep];
}

/**
 * The one thing a course with the Book shows bright: what the story wants next. A story (one-off) scene
 * here; at bedtime the bed, or the way to it; else the way to the next story scene; else a repeatable
 * scene here. Undefined when none of these is on the menu; the rest stay quiet beside it.
 */
export function primaryItem(course: Course, state: GameState, menu: MenuItem[]): number | undefined {
  const open = (m: MenuItem) => !("disabled" in m && m.disabled);
  const talk = (oneOff: boolean) =>
    menu.findIndex((m) => m.kind === "talk" && open(m) && !course.scenes.find((s) => s.id === m.scene)?.repeatable === oneOff);
  const toward = (goal: string | undefined) => {
    const step = goal ? firstStep(course, state, goal) : undefined;
    return step ? menu.findIndex((m) => m.kind === "go" && m.place === step) : -1;
  };
  const story = talk(true);
  if (story >= 0) return story;
  if (bedtime(course, state)) {
    const sleep = menu.findIndex((m) => m.kind === "sleep");
    if (sleep >= 0) return sleep;
    const bed = toward(bedPlace(course, state));
    if (bed >= 0) return bed;
  }
  const next = availableSceneIds(course, state)
    .map((id) => course.scenes.find((s) => s.id === id)!)
    .find((s) => !s.repeatable && s.place !== state.place && !moneyBlocked(s, state));
  const way = toward(next?.place);
  if (way >= 0) return way;
  const job = talk(false);
  return job >= 0 ? job : undefined;
}

/**
 * The menu as a course with the Book draws it when nothing is bright (see primaryItem): the likeliest
 * first. A talk here, then a way to somewhere a scene waits (on the shortest walk), then the mentor, then
 * the other ways, then sleep; ties keep the menu's order.
 */
export function likelyOrder(course: Course, state: GameState, menu: MenuItem[]): MenuItem[] {
  const waiting = new Set(availableSceneIds(course, state).map((id) => course.scenes.find((s) => s.id === id)!.place));
  const toward = new Set([...waiting].map((p) => firstStep(course, state, p)).filter((p) => p !== undefined));
  const rank = (m: MenuItem) => (m.kind === "talk" ? 0 : m.kind === "go" ? (toward.has(m.place) ? 1 : 3) : m.kind === "mentor" ? 2 : 4);
  return menu.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map(({ m }) => m);
}

/** The first known place on the shortest walk from here to `goal`. */
function firstStep(course: Course, state: GameState, goal: string): string | undefined {
  const from = new Map<string, string>([[state.place, ""]]);
  const queue = [state.place];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === goal) break;
    for (const p of course.world.places[at].links) {
      if (from.has(p) || !placeKnown(course, state, p)) continue;
      from.set(p, at);
      queue.push(p);
    }
  }
  if (!from.has(goal) || goal === state.place) return undefined;
  let step = goal;
  while (from.get(step) !== state.place) step = from.get(step)!;
  return step;
}

/** Where the player sleeps: their home once they have one, else where they started. */
export const bedPlace = (course: Course, state: GameState): string =>
  hasHome(course, state) && course.world.home ? course.world.home : course.world.start;

/** Whether it's time to sleep (see bedtime): a front end words its way to the bed for it. */
export const isBedtime = (course: Course, state: GameState): boolean => bedtime(course, state);

/** Time to sleep: the day's time is gone, or no scene or visit is open anywhere. */
function bedtime(course: Course, state: GameState): boolean {
  if (state.slot >= course.world.slotsPerDay) return true;
  return !availableSceneIds(course, state).length && !(mentorAvailable(course, state) && state.notes.ready.length);
}

/**
 * Where to sleep, once it's time and the bed is elsewhere: its place, and the known place it's off
 * unless that's here. Nothing otherwise, so the menu's sleep item is never repeated.
 */
export function bedHint(course: Course, state: GameState, t: Text): string[] {
  if (canSleep(course, state) || !bedtime(course, state)) return [];
  const bed = bedPlace(course, state);
  const links = course.world.places[bed].links;
  const via = links.includes(state.place) ? undefined : links.find((p) => placeKnown(course, state, p));
  const place = t(`place-${bed}`);
  return [via ? t("sleep-go-via", { place, via: t(`place-${via}`) }) : t("sleep-go", { place })];
}

/** Scenes here that wait only for money: shown, not offered, so an empty shop says why. */
export function waitingForMoney(course: Course, state: GameState, t: Text): string[] {
  return course.scenes
    .filter((x) => x.place === state.place && moneyBlocked(x, state))
    .map((x) => t("menu-needs-money", { npc: t(`npc-${x.npc}`), scene: t(`scene-${x.id}`), currency: course.world.currency, cost: sceneCost(x) }));
}
