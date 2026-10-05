import { PLAYER_MARK, comboKey, wordState, type Course, type GameEvent, type GameState, type Word } from "@silver-tongue/core";
import { bookOn, extra } from "./course-extra";
import { displayGloss } from "./help";
import { heardCount, onboarding } from "./ruby";
import { sumTiles, letterChart } from "./desk-read";
import { npcLabel } from "./person";
import type { Text } from "./text";

/** The player's own thoughts. Presentation only; never sends an input to core. */
export const VOICE_MARK = "›";
export const VOICE_LIMIT = 140;
export const VOICE_POOLS = ["echo", "small-talk", "first-day", "first-miss", "second-miss", "stall", "new-word", "scene-end", "day-start", "night", "desk-wrong", "paper-done"] as const;
export type VoiceTrigger = (typeof VOICE_POOLS)[number];
export const VOICE_VARS = ["npc", "npcShort", "asked", "word", "gloss", "wordMeaning", "shape", "memory", "reflection", "situation", "rule", "paper", "day", "wallet", "currency", "known", "hunger"];
export interface VoiceCue { trigger: VoiceTrigger; day: number; vars: Record<string, string | number>; once?: string; avoid?: string[]; pool?: VoiceTrigger }
export interface VoiceMemory { day: number; seed: number; used: string[]; once: string[]; picks: number }
export const emptyVoice = (seed = 1): VoiceMemory => ({ day: 0, seed, used: [], once: [], picks: 0 });
export function voiceSeed(id: string): number {
  let seed = 2166136261;
  for (const ch of id) seed = Math.imul(seed ^ ch.codePointAt(0)!, 16777619);
  return seed >>> 0;
}
export function parseVoice(value: unknown, seed = 1): VoiceMemory {
  const v = (value && typeof value === "object" ? value : {}) as Partial<VoiceMemory>;
  const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : [];
  return { day: Number.isInteger(v.day) ? v.day! : 0, seed: Number.isInteger(v.seed) ? v.seed! : seed, picks: Number.isInteger(v.picks) ? v.picks! : 0, used: strings(v.used), once: strings(v.once) };
}
export const voiceOn = (course: Course): boolean => course.language.code === "ko" && bookOn(course);
/** Only the NPC explanation may be shortened; complete thoughts are never clipped. */
export const voiceAsked = (s: string): string => [...s].length <= 56 ? s : [...s].slice(0, 55).join("") + "…";
export const npcShort = (label: string): string => label.replace(/^The /, "the ").replace(/^A /, "a ");
/** Menu intents remain unchanged; only my internal paraphrase changes person. */
export function voiceIntent(intent: string): string {
  if (intent === "Answer his question honestly") return "say no, and that I don't know Korean";
  if (intent === "Say you're not") return "say I'm not a student";
  const own = intent.replace(/\byou're\b/g, "I'm").replace(/\byou've\b/g, "I've").replace(/\byou\b/g, "I").replace(/\byour\b/g, "my").replace(/\byours\b/g, "mine");
  return own.charAt(0).toLowerCase() + own.slice(1);
}
export const voiceGloss = (gloss: string): string => gloss.split(";")[0].trim().replace(/[?!]+$/, "").trim();
/** Inflected forms have readings, not glosses; avoid equating them to the dictionary form. */
export function voiceWord(w: Word, surface: string, t: Text): string {
  const gloss = voiceGloss(displayGloss(w));
  return surface !== w.w && w.forms?.[surface] ? t("voice-form-origin", { base: w.w, gloss }) : t("voice-word-meaning", { gloss });
}
export function deskVoiceRule(course: Course, ch: string): "silent" | "final" | "sum" {
  const tiles = sumTiles(letterChart(course), ch, new Set());
  return tiles.some((tl) => tl.letter.ch === "ㅇ" && !tl.final) ? "silent" : tiles.some((tl) => tl.final) ? "final" : "sum";
}
const varsFor = (course: Course, state: GameState, now: number): VoiceCue["vars"] => ({
  // Keep money numeric: Fluent uses the same learner-locale number formatter as the HUD.
  day: state.day, wallet: state.wallet, currency: course.world.currency,
  known: Object.values(state.words).filter((w) => wordState(w, now) === "known").length,
  // Core exposes a rough night rather than a separate hunger input. This is the food-budget flag.
  hunger: state.wallet < course.world.foodPerDay ? 1 : 0,
});
export function voiceSituation(course: Course, state: GameState, t: Text): string {
  const id = state.wallet < course.world.foodPerDay ? "hungry" : state.rentLate ? "rent" : state.scenesDone["room-rent"] ? "march" : !Object.keys(state.scenesDone).length ? "room" : "wallet";
  return t(`voice-situation-${id}`, { wallet: state.wallet, currency: course.world.currency });
}
export function voiceDay(course: Course, state: GameState, t: Text, now: number, trigger: "day-start" | "night" = "day-start", hungry = false): VoiceCue {
  return { trigger, pool: trigger === "day-start" && state.day === 1 ? "first-day" : trigger, day: state.day, vars: { ...varsFor(course, state, now), hunger: hungry ? 1 : varsFor(course, state, now).hunger, situation: hungry ? t("voice-situation-hungry") : voiceSituation(course, state, t) }, once: `${trigger}:${state.day}` };
}
/** Uses only the NPC's line and the reply's English intent. Never includes an unearned target-language reply. */
export function voiceHint(course: Course, state: GameState, t: Text, now: number, trigger: "first-miss" | "second-miss" | "stall"): VoiceCue | undefined {
  const run = state.run;
  const scene = run && course.scenes.find((s) => s.id === run.scene);
  const ex = scene && run && scene.exchanges[run.exchange];
  const v = run && ex?.variants[comboKey(run.combo)];
  if (!scene || !ex || !v) return undefined;
  const hinges = ex.hinges.flatMap((h) => course.concepts[h.startsWith("$") ? run!.combo[h.slice(1)] : h] ?? []);
  const why = (v as typeof v & { why?: string }).why;
  const tk = v.npc.tokens.find((tk) => why?.includes(v.npc.text.slice(tk.start, tk.end))) ?? v.npc.tokens.find((tk) => hinges.includes(tk.word) && !extra(course).words[tk.word]?.attach) ?? [...v.npc.tokens].reverse().find((tk) => !extra(course).words[tk.word]?.attach);
  const word = tk ? v.npc.text.slice(tk.start, tk.end) : "";
  const w = tk && course.words[tk.word];
  const gloss = w ? voiceGloss(displayGloss(w)) : "";
  const wordMeaning = w ? voiceWord(w, word, t) : "";
  let memory = t("voice-memory-new");
  for (const talk of state.talks ?? []) {
    const previous = course.scenes.find((s) => s.id === talk.scene);
    previous?.exchanges.forEach((ex, i) => {
      const reply = talk.alts?.[String(i)] === undefined ? ex.variants[talk.keys[i]]?.reply : undefined;
      const repeated = reply?.tokens.find((tk) => v.reply.tokens.some((wanted) => wanted.word === tk.word) && !extra(course).words[tk.word]?.attach);
      if (reply && repeated) memory = t("voice-memory-used", { npcShort: npcShort(npcLabel(course, state, t, previous.npc)) });
    });
  }
  const earned = (state.talks ?? []).some((talk) => {
    const scene = course.scenes.find((s) => s.id === talk.scene);
    return scene?.exchanges.some((ex, i) => talk.alts?.[String(i)] === undefined && ex.variants[talk.keys[i]]?.reply.text === v.reply.text);
  });
  const avoid = earned ? [] : v.reply.tokens.map((tk) => v.reply.text.slice(tk.start, tk.end));
  const echo = !earned && !!word && (v.reply.text.includes(word) || avoid.some((r) => word.includes(r)));
  const asked = why ?? v.npc.meaning ?? t("voice-asked-fallback");
  return { trigger, ...(echo && trigger !== "second-miss" ? { pool: "echo" as const } : {}), ...(scene.id === "copy-shift" && ex.id.startsWith("chat-") && trigger !== "second-miss" ? { pool: "small-talk" as const } : {}), day: state.day, avoid, vars: {
    ...varsFor(course, state, now), npc: npcLabel(course, state, t, scene.npc), npcShort: npcShort(npcLabel(course, state, t, scene.npc)),
    asked: voiceAsked(asked), word, gloss, wordMeaning,
    shape: v.reply.intent ? t("voice-shape-intent", { intent: voiceIntent(v.reply.intent) }) : t("voice-shape-fallback"),
    memory,
  } };

}
/** Batch snapshots matter: core.state already holds the next exchange/day when its events arrive. */
export function voiceEvents(course: Course, before: GameState, after: GameState, events: readonly GameEvent[], t: Text, now: number): VoiceCue[] {
  if (!voiceOn(course)) return [];
  const out: VoiceCue[] = [];
  const missed = events.some((e) => e.type === "actionPerformed" && (!e.matched || e.tilesWrong)) || (before.run && after.run && before.run.scene === after.run.scene && before.run.exchange === after.run.exchange && after.run.misses > before.run.misses);
  if (missed && (before.run?.misses ?? 0) < 2) {
    const hint = voiceHint(course, before, t, now, (before.run?.misses ?? 0) === 0 ? "first-miss" : "second-miss");
    if (hint) out.push(hint);
  }
  const fresh = events.filter((e): e is Extract<GameEvent, { type: "wordStateChanged" }> => e.type === "wordStateChanged" && e.from === "unseen");
  if (!onboarding(course, heardCount(before.words, now))) {
    const avoid = voiceHint(course, after, t, now, "stall")?.avoid;
    const heard = events.flatMap((e) => e.type === "lineSpoken" || e.type === "lineRephrased" ? [e.line] : []);
    for (const e of fresh) {
      const line = heard.find((l) => l.tokens.some((tk) => tk.word === e.word));
      const tk = line?.tokens.find((tk) => tk.word === e.word);
      const w = course.words[e.word];
      if (line && tk && w) out.push({ trigger: "new-word", day: after.day, ...(avoid ? { avoid } : {}), vars: { ...varsFor(course, after, now), word: line.text.slice(tk.start, tk.end), gloss: voiceGloss(displayGloss(w)), wordMeaning: voiceWord(w, line.text.slice(tk.start, tk.end), t) }, once: `word:${e.word}` });
    }
  }
  for (const e of events) {
    if (e.type === "sceneEnded") {
      const loss = events.some((x) => x.type === "walletChanged" && x.reason === "mixup" && x.delta < 0);
      const talk = [...(after.talks ?? [])].filter((talk) => talk.scene === e.scene).sort((a, b) => b.day - a.day || b.slot - a.slot)[0];
      const acceptedAlt = talk && Object.keys(talk.alts ?? {}).length > 0;
      const priorEarnings = (before.talks ?? []).some((talk) => talk.earned > 0);
      const id = e.earned > 0 && !priorEarnings ? "first-earned" : e.earned > 0 ? "earned" : loss || (acceptedAlt && e.scene === "shop-prices") ? "change" : acceptedAlt && e.scene === "room-wake" ? "lie" : e.scene === "room-wake" ? "landlady" : e.scene === "street-hello" ? "desk" : e.scene === "room-rent" ? "march" : "heard";
      out.push({ trigger: "scene-end", day: before.day, vars: { ...varsFor(course, after, now), reflection: t(`voice-reflection-${id}`) } });
    }
    if (e.type === "dayEnded") {
      out.push(voiceDay(course, before, t, now, "night", e.rough), voiceDay(course, after, t, now, "day-start", e.rough));
    }
  }
  return out;
}
export function voiceDesk(course: Course, state: GameState, t: Text, now: number, trigger: "desk-wrong" | "paper-done", value: string): VoiceCue {
  return { trigger, day: state.day, vars: { ...varsFor(course, state, now), rule: value, paper: value }, ...(trigger === "paper-done" ? { once: `paper:${value}` } : {}) };
}
/** Four variant identities per pool/day, regardless of changing state variables. */
export function pickVoice(memory: VoiceMemory, cue: VoiceCue, t: Text): { memory: VoiceMemory; line?: string } {
  const next: VoiceMemory = { ...memory, day: Math.max(memory.day, cue.day), used: cue.day > memory.day ? [] : [...memory.used], once: [...memory.once] };
  if (cue.once && next.once.includes(cue.once)) return { memory: next };
  const candidates: { id: string; line: string }[] = [];
  const pool = cue.pool ?? cue.trigger;
  for (let i = 1; t.has(`voice-${pool}-${i}`); i++) {
    const id = `${pool}-${i}`;
    const line = t(`voice-${id}`, cue.vars);
    if ([...line].length > VOICE_LIMIT) continue;
    if (!next.used.includes(id) && !(cue.avoid?.some((word) => word && line.includes(word)))) candidates.push({ id, line });
  }
  if (!candidates.length) return { memory: next };
  let seed = (next.seed ^ Math.imul(cue.day, 2654435761) ^ Math.imul(next.picks + 1, 1597334677)) >>> 0;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  const chosen = candidates[(seed >>> 0) % candidates.length];
  next.used.push(chosen.id); next.picks++;
  if (cue.once) next.once.push(cue.once);
  return { memory: next, line: chosen.line };
}
