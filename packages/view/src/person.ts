import { isAvailable, personalize, placeKnown, sceneCost, wordState, type Course, type GameState, type Scene, type WordId } from "@silver-tongue/core";
import { wordLine, type WordLine } from "./assist";
import { dayPart, type DayPart } from "./hud";
import type { Text } from "./text";

/** Trust as a bar shows it: 0-5. */
const TRUST_MAX = 5;

/** A person on the status page's list. */
export interface PersonRow {
  npc: string;
  name: string;
  place: string;
  /** 0-5 */
  trust: number;
}

/** A person is met once a conversation with them is done. */
const met = (course: Course, state: GameState, npc: string) => course.scenes.some((s) => s.npc === npc && (state.scenesDone[s.id] ?? 0) > 0);

/** How far into the story a scene is: the longest chain of scenes that must come before it. */
function depths(course: Course): Map<string, number> {
  const out = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (out.has(id)) return out.get(id)!;
    const scene = course.scenes.find((s) => s.id === id);
    if (!scene || seen.has(id)) return 0;
    seen.add(id);
    const d = scene.after.length ? 1 + Math.max(...scene.after.map((a) => depth(a, seen))) : 0;
    out.set(id, d);
    return d;
  };
  for (const s of course.scenes) depth(s.id, new Set());
  return out;
}

/**
 * Everyone in the course, the people met and the rest, each in the order the story introduces
 * them (their earliest scene), so the next person to meet is first of the rest.
 */
export function peopleList(course: Course, state: GameState, t: Text): { met: PersonRow[]; unmet: PersonRow[] } {
  const d = depths(course);
  const first = (npc: string) => Math.min(...course.scenes.filter((s) => s.npc === npc).map((s) => d.get(s.id) ?? 0));
  const rows = Object.keys(course.world.npcs)
    .sort((a, b) => first(a) - first(b))
    .map((npc) => ({ npc, name: t(`npc-${npc}`), place: t(`place-${course.world.npcs[npc].place}`), trust: Math.min(TRUST_MAX, state.trust[npc] ?? 0) }));
  return { met: rows.filter((r) => met(course, state, r.npc)), unmet: rows.filter((r) => !met(course, state, r.npc)) };
}

/** What a conversation needs before it opens: each thing, and whether it's done. */
export interface TipNeed {
  text: string;
  done: boolean;
}

/** A conversation still to have with someone, and what it takes. */
export interface PersonTip {
  label: string;
  /** can be had again and again (work) */
  repeat: boolean;
  /** open now */
  open: boolean;
  /** what it gives: "+1 trust · +¥10"; "" when nothing */
  gains: string;
  /** what's still needed, and the trust it needs even when there's enough; empty when nothing */
  needs: TipNeed[];
}

/** A conversation had, as its lines. */
export interface PersonTalk {
  title: string;
  day: number;
  part: DayPart;
  earned: number;
  lines: { who: "npc" | "player"; text: string; meaning: string }[];
}

export interface PersonView {
  npc: string;
  name: string;
  place: string;
  /** one line about them; absent when the course has none */
  desc?: string;
  met: boolean;
  /** where to find them ("at the Warehouse, off Market Street"), until they're met */
  where?: string;
  /** 0-5 */
  trust: number;
  tips: PersonTip[];
  /** the conversations kept, newest first */
  talks: PersonTalk[];
  /** the words of their conversations: heard (with how well they're known) and not yet */
  words: { heard: (WordLine & { shaky: boolean })[]; notYet: WordLine[] };
}

/** The place, and the known place it's off when that's not here, so someone not met yet can be found. */
function whereIs(course: Course, state: GameState, t: Text, place: string): string {
  const name = t(`place-${place}`);
  if (place === state.place || course.world.places[place]?.links.includes(state.place)) return t("person-at", { place: name });
  const via = course.world.places[place]?.links.find((p) => placeKnown(course, state, p));
  return via ? t("person-at-via", { place: name, via: t(`place-${via}`) }) : t("person-at", { place: name });
}

function tipFor(course: Course, state: GameState, t: Text, scene: Scene): PersonTip {
  const needs: TipNeed[] = [];
  for (const id of scene.after) {
    if ((state.scenesDone[id] ?? 0) > 0) continue;
    const before = course.scenes.find((s) => s.id === id);
    const name = t(`scene-${id}`);
    const who = before && before.npc !== scene.npc ? t(`npc-${before.npc}`) : undefined;
    // "Count with Old Wang" already says who: "with Old Wang" again would only repeat it.
    const named = !who || name.toLowerCase().includes(who.toLowerCase());
    needs.push({ text: named ? t("person-after", { scene: name }) : t("person-after-with", { scene: name, npc: who }), done: false });
  }
  for (const [npc, min] of Object.entries(scene.requires.trust ?? {})) {
    const text = npc === scene.npc ? t("person-trust", { trust: min }) : t("person-trust-with", { trust: min, npc: t(`npc-${npc}`) });
    needs.push({ text, done: (state.trust[npc] ?? 0) >= min });
  }
  const cost = sceneCost(scene);
  if (cost > 0) needs.push({ text: t("person-costs", { currency: course.world.currency, cost }), done: state.wallet >= cost });
  if (scene.endsErrand) needs.push({ text: t("person-bring-parcel"), done: state.errand?.to === scene.place });
  if (scene.startsErrand && state.errand) needs.push({ text: t("person-parcel-first"), done: false });
  const pay = scene.exchanges.reduce((sum, ex) => sum + ex.pay, 0);
  const gains = [
    ...(scene.trustGain > 0 ? [t("person-gains-trust", { trust: scene.trustGain })] : []),
    ...(pay > 0 ? [`+${course.world.currency}${pay}`] : []),
  ].join(" · ");
  return { label: t(`scene-${scene.id}`), repeat: scene.repeatable, open: isAvailable(scene, state), gains, needs };
}

/** The words of someone's conversations, each once, in the order they come up. */
function wordsOf(course: Course, npc: string): WordId[] {
  const seen = new Set<WordId>();
  for (const s of course.scenes.filter((x) => x.npc === npc))
    for (const ex of s.exchanges)
      for (const v of Object.values(ex.variants)) for (const tk of [...v.npc.tokens, ...v.reply.tokens]) seen.add(tk.word);
  return [...seen].filter((w) => course.words[w]);
}

/**
 * Everything the person view shows: who they are and how well they know you; the conversations
 * still to have with them, open first, each with what it needs (where to find them, for someone not
 * met yet); the conversations had, as kept by core; and their words, heard and not yet.
 */
export function personView(course: Course, state: GameState, t: Text, npc: string, now: number): PersonView {
  const known = met(course, state, npc);
  const theirs = course.scenes.filter((s) => s.npc === npc);
  const tips = theirs.filter((s) => s.repeatable || !(state.scenesDone[s.id] ?? 0)).map((s) => tipFor(course, state, t, s));
  const home = course.world.npcs[npc].place;
  const name = state.player ?? "";
  const talks: PersonTalk[] = (state.talks ?? [])
    .flatMap((talk) => {
      const scene = theirs.find((s) => s.id === talk.scene);
      if (!scene) return [];
      const lines = scene.exchanges.flatMap((ex, i) => {
        const v = ex.variants[talk.keys[i]];
        if (!v) return [];
        const npcLine = personalize(v.npc, name);
        const reply = personalize(v.reply, name);
        return [
          { who: "npc" as const, text: npcLine.text, meaning: npcLine.meaning ?? "" },
          { who: "player" as const, text: reply.text, meaning: reply.meaning ?? "" },
        ];
      });
      return [{ title: t(`scene-${scene.id}`), day: talk.day, part: dayPart(course, { ...state, slot: talk.slot - 1, run: null }), earned: talk.earned, lines }];
    })
    .reverse();
  const heard: PersonView["words"]["heard"] = [];
  const notYet: WordLine[] = [];
  for (const w of wordsOf(course, npc)) {
    const st = wordState(state.words[w], now);
    if (st === "unseen") notYet.push(wordLine(course, w));
    else heard.push({ ...wordLine(course, w), shaky: st === "shaky" });
  }
  const descId = `npc-${npc}-desc`;
  return {
    npc,
    name: t(`npc-${npc}`),
    place: t(`place-${home}`),
    ...(t.has(descId) ? { desc: t(descId) } : {}),
    met: known,
    ...(known ? {} : { where: whereIs(course, state, t, home) }),
    trust: Math.min(TRUST_MAX, state.trust[npc] ?? 0),
    tips: [...tips.filter((x) => x.open), ...tips.filter((x) => !x.open)],
    talks,
    words: { heard, notYet },
  };
}
