import { FluentBundle, FluentResource } from "@fluent/bundle";
import { PLAYER_MARK, tilePieces, type Course, type RenderedLine, type Scene, type Variant, type WordId } from "@silver-tongue/core";
import { makeText, displayGloss, voiceGloss, voiceWord, voiceIntent, npcShort, voiceAsked, VOICE_LIMIT, VOICE_POOLS, VOICE_VARS, voiceOn, extra, type ExchangeExtra } from "@silver-tongue/view";
import { speakable } from "./voices";

export interface CheckInput {
  course: Course;
  /** stage number -> pack levels it covers */
  stages: Record<string, string[]>;
  checks: { coverage: boolean; audio: boolean; art?: boolean };
  /** message ids available in the learner-language files */
  learnerIds: Set<string>;
  /** Namespaced learner explanation ids, collected while reading scene Fluent files. */
  whyIds?: Set<string>;
  /** message ids the front ends need */
  requiredUi: string[];
  /** clip ids that have a file (checked when checks.audio is on) */
  audioFiles?: Set<string>;
  /** scene id -> a fixed new-word limit for its exchanges, replacing the ratio rule */
  newWordsOverride?: Record<string, number>;
}

export const MAX_NEW_PER_EXCHANGE = 2;
/** Below this many words met, a scene gets the most lenient band. */
export const LENIENT_BELOW_MET = 30;
/** Below this many words met (but not the lenient band), a scene gets the middle band. */
export const EASING_BELOW_MET = 60;
/**
 * How many new words a variant may introduce: an override (a scene's own `newWords`) if one is
 * given; otherwise a scene early in the course, where the player knows few words yet, gets a
 * flat, generous cap (4 new words met before 30, 3 before 60); once the player knows 60+ words,
 * the limit is the usual ratio: at least 2, or 20% of the variant's distinct words, whichever is
 * bigger, so a longer exchange can carry more new words while staying mostly familiar.
 */
export const newWordLimit = (metCount: number, distinctWords: number, override?: number): number => {
  if (override !== undefined) return override;
  if (metCount < LENIENT_BELOW_MET) return 4;
  if (metCount < EASING_BELOW_MET) return 3;
  return Math.max(MAX_NEW_PER_EXCHANGE, Math.floor(distinctWords * 0.2));
};
export const MIN_SCENES_PER_WORD = 3;
/** Every choice is one key, 1-9: a reply's tiles are its words plus up to 2 extra. */
export const MAX_REPLY_WORDS = 7;
/** Word help offers each word of the NPC's line on keys 1-9. */
export const MAX_LINE_WORDS = 9;
/**
 * A place's menu: its scenes, exits and the mentor's visit on keys 1-7, then sleep and quit. The
 * mentor's item always counts, though the menu shows it only when a note is waiting, so no place
 * can overflow once one is.
 */
export const MAX_PLACE_ITEMS = 7;

/**
 * At most how many of a place's scenes are offered at once. A one-off scene is gone once done, so it's
 * never offered with a scene there that comes after it: each one-off is paired with its own follow-up
 * and counts only when it has none.
 */
function mostScenesAtOnce(scenes: Scene[]): number {
  const taken = new Set<string>();
  let replaced = 0;
  for (const x of scenes) {
    if (x.repeatable) continue;
    const next = scenes.find((y) => y.after.includes(x.id) && !taken.has(y.id));
    if (next) (taken.add(next.id), replaced++);
  }
  return scenes.length - replaced;
}

/** Scenes in `after` order; ties keep file order. */
export function orderScenes(scenes: Scene[]): { ordered: Scene[]; errors: string[] } {
  const done = new Set<string>();
  const ordered: Scene[] = [];
  const pending = [...scenes];
  while (pending.length) {
    const i = pending.findIndex((s) => s.after.every((a) => done.has(a)));
    if (i < 0) {
      // Keep checking the stuck scenes too, so one cycle doesn't hide their other errors.
      return { ordered: [...ordered, ...pending], errors: [`scene order has a cycle or a missing scene: ${pending.map((s) => s.id).join(", ")}`] };
    }
    const [s] = pending.splice(i, 1);
    ordered.push(s);
    done.add(s.id);
  }
  return { ordered, errors: [] };
}

/** Whether `to` can be walked to from `from` along place links, keeping to `open` places if given. */
function reaches(places: Course["world"]["places"], from: string, to: string, open?: (place: string) => boolean): boolean {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    if (p === to) return true;
    for (const next of places[p]?.links ?? []) {
      if (seen.has(next) || (open && !open(next))) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

const lineWords = (l: RenderedLine | undefined): WordId[] => (l ? l.tokens.map((t) => t.word) : []);

/** The NPC's own answers to written wrong replies, by the reply's position in `alts`. */
const altAnswers = (v: Variant): [number, RenderedLine][] =>
  Object.entries(v.altOutcomes ?? {}).flatMap(([i, o]): [number, RenderedLine][] => (o.reaction ? [[Number(i), o.reaction]] : []));

/** Every scene line: the NPC's, the rephrase, the reply, the written wrong replies and the NPC's answers to them. */
const variantLines = (v: Variant): [string, RenderedLine | undefined][] => [
  ["npc", v.npc],
  ["rephrase", v.rephrase],
  ["reply", v.reply],
  ...(v.alts ?? []).map((a, i): [string, RenderedLine] => [`alt${i + 1}`, a]),
  ...altAnswers(v).map(([i, a]): [string, RenderedLine] => [`alt${i + 1}-answer`, a]),
];

/** The words a course uses: in its lines, its reactions and its concepts. */
export function usedWords(course: Course): Set<WordId> {
  return new Set([
    ...Object.values(course.concepts).flat(),
    ...Object.values(course.reactions).flatMap(lineWords),
    ...course.scenes.flatMap((s) =>
      s.exchanges.flatMap((ex) => Object.values(ex.variants).flatMap((v) => variantLines(v).flatMap(([, l]) => lineWords(l)))),
    ),
  ]);
}

/** Lines, words and reactions without clips, and clips without a file. */
function audioProblems(course: Course, files: Set<string>): string[] {
  const errors: string[] = [];
  const clips = new Set<string>();
  const need = (ids: string[] | undefined, problem: string, text?: string) => {
    // A line that is only the player's name ("\uE000？") has nothing to say, so no clips is right.
    const silent = text !== undefined && !speakable(text.split(PLAYER_MARK).join(""));
    if (ids === undefined || (!ids.length && !silent)) errors.push(problem);
    for (const id of ids ?? []) clips.add(id);
  };
  for (const s of course.scenes) {
    for (const ex of s.exchanges) {
      for (const [key, v] of Object.entries(ex.variants)) {
        const where = `${s.id}/${ex.id}${key ? `[${key}]` : ""}`;
        for (const [name, l] of variantLines(v)) if (l) need(l.audio, `${where}: ${name} line has no audio`, l.text);
      }
    }
  }
  const speakers = [...new Set(course.scenes.map((s) => s.npc))].sort();
  for (const id of Object.keys(course.reactions)) {
    for (const npc of speakers) need(course.reactionAudio?.[id]?.[npc], `reaction ${id}: no audio for ${npc}`);
  }
  for (const w of [...usedWords(course)].sort()) need(course.words[w]?.audio, `word ${w} "${course.words[w]?.w ?? ""}": no audio`);
  for (const g of extra(course).letters?.groups ?? []) for (const l of g.letters) need(l.audio, `letters ${g.id} "${l.ch}": no audio`);
  for (const p of extra(course).papers ?? []) for (const l of p.lines) need(l.audio, `papers ${p.id}/${l.id} "${l.text}": no audio`);
  for (const id of [...clips].sort()) if (!files.has(id)) errors.push(`audio: no file for clip ${id}`);
  return errors;
}

/** Every scene each scene comes after, directly or not. */
function ancestors(scenes: Scene[]): Map<string, Set<string>> {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const memo = new Map<string, Set<string>>();
  const visit = (id: string, path: Set<string>): Set<string> => {
    const known = memo.get(id);
    if (known) return known;
    const out = new Set<string>();
    if (path.has(id)) return out; // a cycle, reported by orderScenes
    path.add(id);
    for (const a of byId.get(id)?.after ?? []) {
      out.add(a);
      for (const x of visit(a, path)) out.add(x);
    }
    path.delete(id);
    memo.set(id, out);
    return out;
  };
  for (const s of scenes) visit(s.id, new Set());
  return memo;
}

/** Slot, group and concept names end up in combo keys ("count=three|item=tea"), so they stay simple. */
const NAME = /^[A-Za-z0-9_-]+$/;
const isCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

/** Duplicates in a list, each named once. */
const dupes = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

export function checkCourse(input: CheckInput): string[] {
  const { course, stages, checks, learnerIds } = input;
  const errors: string[] = [];
  const { world } = course;
  errors.push(...voiceProblems(course, learnerIds, input.whyIds));

  if (!world.places[world.start]) errors.push(`world: start place "${world.start}" does not exist`);
  // Saves hold whole numbers only, so money, time and trust amounts must be whole numbers too.
  for (const k of ["startWallet", "foodPerDay", "rentPerWeek"] as const) {
    if (!isCount(world[k])) errors.push(`world: ${k} must be a whole number of 0 or more`);
  }
  if (!isCount(world.slotsPerDay) || world.slotsPerDay < 1) errors.push("world: slotsPerDay must be a whole number of 1 or more");
  for (const name of Object.keys(course.concepts)) {
    if (!NAME.test(name)) errors.push(`concepts: "${name}" may only use letters, digits, _ and -`);
  }
  for (const [name, members] of Object.entries(course.groups)) {
    if (!NAME.test(name)) errors.push(`groups: "${name}" may only use letters, digits, _ and -`);
    if (members.length === 0) errors.push(`groups: "${name}" is empty`);
    for (const d of dupes(members)) errors.push(`groups: "${name}" lists "${d}" twice`);
    for (const m of members) if (!(m in course.concepts)) errors.push(`groups: "${name}" has unknown concept "${m}"`);
  }
  for (const [id, p] of Object.entries(world.places)) {
    for (const l of p.links) if (!world.places[l]) errors.push(`world: place "${id}" links to unknown place "${l}"`);
    for (const a of p.after ?? []) if (!course.scenes.some((s) => s.id === a)) errors.push(`world: place "${id}" is after unknown scene "${a}"`);
  }
  // The player starts there, and sleeps there before they have a home.
  if (world.places[world.start]?.after?.length) errors.push(`world: start place "${world.start}" must be known from the start`);
  for (const [id, p] of Object.entries(world.places)) {
    // The mentor's visit is an item too, at the mentor's place.
    const mentorItem = world.mentor && world.npcs[world.mentor.npc]?.place === id ? 1 : 0;
    const items = p.links.length + mostScenesAtOnce(course.scenes.filter((s) => s.place === id)) + mentorItem;
    if (items > MAX_PLACE_ITEMS) errors.push(`world: place "${id}" has ${items} menu items; at most ${MAX_PLACE_ITEMS}`);
  }
  if (world.home !== undefined && !world.places[world.home]) errors.push(`world: home "${world.home}" is not a place`);
  else if (world.home !== undefined) {
    // Sleep works only at home, so a place with no way home would be a day that never ends.
    for (const id of Object.keys(world.places)) {
      if (!reaches(world.places, id, world.home)) errors.push(`world: home "${world.home}" can't be reached from "${id}"`);
    }
  }
  if (world.homeScene !== undefined) {
    const scene = course.scenes.find((s) => s.id === world.homeScene);
    if (!scene) errors.push(`world: homeScene "${world.homeScene}" is not a scene`);
    else if (scene.repeatable) errors.push(`world: homeScene "${world.homeScene}" can't be repeatable`);
  }
  for (const [id, n] of Object.entries(world.npcs)) {
    if (!world.places[n.place]) errors.push(`world: npc "${id}" is at unknown place "${n.place}"`);
  }

  const sceneIds = new Set(course.scenes.map((s) => s.id));
  for (const d of dupes(course.scenes.map((s) => s.id))) errors.push(`scenes: id "${d}" is used twice`);
  const before = ancestors(course.scenes);
  for (const s of course.scenes) {
    for (const d of dupes(s.exchanges.map((e) => e.id))) errors.push(`${s.id}: exchange id "${d}" is used twice`);
    if (!world.places[s.place]) errors.push(`${s.id}: unknown place "${s.place}"`);
    else {
      // Once the scene opens, the player must know a way to its place.
      const done = before.get(s.id) ?? new Set<string>();
      const open = (place: string) => (world.places[place]?.after ?? []).every((a) => done.has(a));
      if (!reaches(world.places, world.start, s.place, open)) errors.push(`${s.id}: opens before the player knows the way to "${s.place}"`);
    }
    if (!world.npcs[s.npc]) errors.push(`${s.id}: unknown npc "${s.npc}"`);
    for (const a of s.after) if (!sceneIds.has(a)) errors.push(`${s.id}: after unknown scene "${a}"`);
    for (const [npc, need] of Object.entries(s.requires.trust ?? {})) {
      if (!world.npcs[npc]) {
        errors.push(`${s.id}: requires trust with unknown npc "${npc}"`);
        continue;
      }
      // Trust comes from finishing scenes with that npc (trustGain, +1 without mix-ups).
      // Only scenes that can be played before this one count.
      const sources = course.scenes.filter((x) => x.npc === npc && x.id !== s.id && !before.get(x.id)?.has(s.id));
      const most = sources.some((x) => x.repeatable) ? Infinity : sources.reduce((n, x) => n + x.trustGain + 1, 0);
      if (most < need) errors.push(`${s.id}: needs trust ${need} with "${npc}", but earlier scenes give at most ${most}`);
    }
    if (!isCount(s.trustGain)) errors.push(`${s.id}: trustGain must be a whole number of 0 or more`);
    const { rent } = s as { rent?: unknown };
    if (rent !== undefined && typeof rent !== "boolean") errors.push(`${s.id}: rent must be true or false`);
    for (const ex of s.exchanges) {
      for (const k of ["pay", "missCost"] as const) {
        if (!isCount(ex[k])) errors.push(`${s.id}/${ex.id}: ${k} must be a whole number of 0 or more`);
      }
      if (Object.values(ex.variants).some((v) => v.cost !== undefined && !isCount(v.cost))) {
        errors.push(`${s.id}/${ex.id}: cost must be a whole number of 0 or more`);
      }
      // A pinned line is kept in the Book as it is: one line, so no slots to fill.
      const { pin } = ex as ExchangeExtra;
      if (pin !== undefined && typeof pin !== "boolean") errors.push(`${s.id}/${ex.id}: pin must be true or false`);
      if (pin && Object.keys(ex.slots).length) errors.push(`${s.id}/${ex.id}: a pinned exchange must have no slots`);
      for (const slot of Object.keys(ex.slots)) {
        if (!NAME.test(slot)) errors.push(`${s.id}/${ex.id}: slot "${slot}" may only use letters, digits, _ and -`);
      }
      for (const v of Object.values(ex.expect)) {
        if (v.startsWith("$") && !(v.slice(1) in ex.slots)) errors.push(`${s.id}/${ex.id}: expect uses unknown slot "${v}"`);
      }
      for (const h of ex.hinges) {
        const ok = h.startsWith("$") ? h.slice(1) in ex.slots : h in course.concepts;
        if (!ok) errors.push(`${s.id}/${ex.id}: unknown hinge "${h}"`);
        // A graded slot must show in the reply: otherwise every option says the same and the word
        // is marked right or wrong on nothing the player chose.
        if (!ok || !h.startsWith("$")) continue;
        const slot = h.slice(1);
        const texts = new Map<string, Set<string>>();
        for (const [key, v] of Object.entries(ex.variants)) {
          const rest = key.split("|").filter((p) => !p.startsWith(`${slot}=`)).join("|");
          texts.set(rest, (texts.get(rest) ?? new Set()).add(v.reply.text));
        }
        const values = new Set(Object.keys(ex.variants).map((k) => k.split("|").find((p) => p.startsWith(`${slot}=`))));
        if (values.size > 1 && [...texts.values()].some((t) => t.size < values.size)) {
          errors.push(`${s.id}/${ex.id}: hinge "${h}" doesn't change the reply, so a player can't get it wrong`);
        }
      }
    }
  }

  // Errands: a pickup's slot names the place the parcel goes; each such place has exactly one
  // drop-off, and every drop-off is somewhere a pickup can send you.
  const dropsAt = new Map<string, string[]>();
  for (const s of course.scenes) if (s.endsErrand) dropsAt.set(s.place, [...(dropsAt.get(s.place) ?? []), s.id]);
  const destinations = new Set<string>();
  // A parcel in hand locks the pickup, so its drop-off must always be there to take it.
  for (const s of course.scenes) {
    if (s.startsErrand !== undefined && !s.repeatable) errors.push(`${s.id}: starts an errand, so it must be repeatable`);
    if (!s.endsErrand) continue;
    if (!s.repeatable) errors.push(`${s.id}: ends an errand, so it must be repeatable`);
    if (Object.keys(s.requires.trust ?? {}).length) errors.push(`${s.id}: ends an errand, so it may not require trust (a parcel could never be delivered)`);
  }
  for (const s of course.scenes) {
    if (s.startsErrand === undefined) continue;
    const slot = s.startsErrand.startsWith("$") ? s.startsErrand.slice(1) : "";
    const ex = s.exchanges.find((e) => slot && slot in e.slots);
    if (!ex) {
      errors.push(`${s.id}: startsErrand "${s.startsErrand}" is not a slot of any exchange`);
      continue;
    }
    for (const to of course.groups[ex.slots[slot]] ?? []) {
      destinations.add(to);
      const n = dropsAt.get(to)?.length ?? 0;
      if (!world.places[to]) errors.push(`${s.id}: errand goes to "${to}", which is not a place`);
      else if (n === 0) errors.push(`${s.id}: errand goes to "${to}", which has no scene that ends an errand`);
      else if (n > 1) errors.push(`${s.id}: errand goes to "${to}", which has ${n} scenes that end an errand; needs 1`);
      for (const drop of course.scenes.filter((x) => x.endsErrand && x.place === to)) {
        const met = new Set([s.id, ...(before.get(s.id) ?? [])]);
        for (const a of drop.after) {
          if (!met.has(a)) errors.push(`${drop.id}: comes after "${a}", which a parcel from ${s.id} doesn't need; a parcel could never be delivered`);
        }
      }
    }
  }
  for (const [place, ids] of dropsAt) {
    if (!destinations.has(place)) for (const id of ids) errors.push(`${id}: ends an errand, but no errand goes to "${place}"`);
  }

  const allowed = (stage: number): Set<string> => {
    const lv = new Set<string>();
    for (let i = 1; i <= stage; i++) for (const l of stages[String(i)] ?? []) lv.add(l);
    return lv;
  };
  const checkLevels = (where: string, words: WordId[], stage: number) => {
    const ok = allowed(stage);
    for (const w of new Set(words)) {
      const word = course.words[w];
      if (!word) errors.push(`${where}: unknown word id "${w}"`);
      else if (!word.bonus && !ok.has(word.lv)) errors.push(`${where}: "${word.w}" is level ${word.lv}, above stage ${stage}`);
    }
  };

  const { ordered, errors: orderErrors } = orderScenes(course.scenes);
  errors.push(...orderErrors);
  // Words met before an exchange: those of the scenes it comes after (directly or not), then
  // its own earlier exchanges. Scenes that don't depend on each other can be played in either
  // order, so they don't count for each other.
  // A slot word counts as met once any variant has used it: slot values rotate, favouring
  // words the player is still learning, so every value is met within a few plays.
  // New words are counted per variant (NPC line, reply, rephrase). Words that only appear in
  // other variants' replies (the wrong options in pick and tiles mode) don't count: the player
  // isn't asked to understand them, and the learner model doesn't mark them met.
  const metAfter = new Map<string, Set<WordId>>();
  const scenesUsing = new Map<WordId, Set<string>>();
  for (const s of ordered) {
    const seen = new Set<WordId>();
    for (const a of before.get(s.id) ?? []) for (const w of metAfter.get(a) ?? []) seen.add(w);
    // A scene's leniency band is fixed at how much the player knows when the scene starts, not
    // updated exchange by exchange, so every exchange in an early scene gets the same headroom.
    const metCount = seen.size;
    for (const ex of s.exchanges) {
      const exWords = new Set<WordId>();
      for (const [key, v] of Object.entries(ex.variants)) {
        const where = `${s.id}/${ex.id}${key ? `[${key}]` : ""}`;
        const words = [...lineWords(v.npc), ...lineWords(v.reply), ...lineWords(v.rephrase)];
        const distinct = new Set(words);
        const fresh = [...distinct].filter((w) => !seen.has(w));
        const limit = newWordLimit(metCount, distinct.size, input.newWordsOverride?.[s.id]);
        if (fresh.length > limit) {
          const shown = fresh.map((w) => course.words[w]?.w ?? w).join(" ");
          errors.push(`${where}: ${fresh.length} new words (${shown}); at most ${limit}`);
        }
        checkLevels(where, words, s.stage);
        // Written wrong replies are offered next to the right one: they may use only words the
        // player has met, so every option is something they could have understood.
        for (const alt of v.alts ?? []) {
          const altWords = lineWords(alt);
          checkLevels(where, altWords, s.stage);
          const unmet = [...new Set(altWords)].filter((w) => !seen.has(w) && !words.includes(w));
          if (unmet.length) {
            errors.push(`${where}: the wrong reply "${alt.text}" uses words not met yet: ${unmet.map((w) => course.words[w]?.w ?? w).join(" ")}`);
          }
          const altTiles = tilePieces(alt).length;
          if (altTiles > MAX_REPLY_WORDS) errors.push(`${where}: the wrong reply "${alt.text}" has ${altTiles} words; at most ${MAX_REPLY_WORDS}`);
        }
        // The NPC's answer to a wrong reply is heard only by a player who said it: like the wrong
        // replies, it may use only words met by now, so it never brings in a word of its own.
        for (const [, answer] of altAnswers(v)) {
          const answerWords = lineWords(answer);
          checkLevels(where, answerWords, s.stage);
          const unmet = [...new Set(answerWords)].filter((w) => !seen.has(w) && !words.includes(w));
          if (unmet.length) {
            errors.push(`${where}: the answer "${answer.text}" uses words not met yet: ${unmet.map((w) => course.words[w]?.w ?? w).join(" ")}`);
          }
          if (answer.tokens.length > MAX_LINE_WORDS) errors.push(`${where}: the answer "${answer.text}" has ${answer.tokens.length} words; at most ${MAX_LINE_WORDS}`);
        }
        // Each word is a tile, and so is the player's name.
        const replyTiles = tilePieces(v.reply).length;
        if (replyTiles > MAX_REPLY_WORDS) {
          errors.push(`${where}: the reply has ${replyTiles} words; at most ${MAX_REPLY_WORDS}`);
        }
        for (const [name, l] of [["npc", v.npc], ["rephrase", v.rephrase]] as const) {
          if (l && l.tokens.length > MAX_LINE_WORDS) {
            errors.push(`${where}: the ${name} line has ${l.tokens.length} words; at most ${MAX_LINE_WORDS}`);
          }
        }
        for (const w of words) {
          exWords.add(w);
          if (!scenesUsing.has(w)) scenesUsing.set(w, new Set());
          scenesUsing.get(w)!.add(s.id);
        }
      }
      for (const w of exWords) seen.add(w);
    }
    metAfter.set(s.id, seen);
  }

  // Reactions can play in any scene, so they must fit the earliest stage.
  const minStage = Math.min(...course.scenes.map((s) => s.stage), Infinity);
  for (const [id, l] of Object.entries(course.reactions)) {
    checkLevels(`reaction ${id}`, lineWords(l), Number.isFinite(minStage) ? minStage : 1);
  }
  if (!course.reactions["wrong-generic"]) errors.push(`reactions: "wrong-generic" is required`);
  // A wrong-<slot> reaction is chosen by slot name alone, anywhere in the course, so every exchange
  // with that slot must be about the same kind of thing (the noodle shop's 几杯？ is for cups).
  for (const id of Object.keys(course.reactions)) {
    if (!id.startsWith("wrong-") || id === "wrong-generic") continue;
    const slot = id.slice("wrong-".length);
    const groups = [...new Set(course.scenes.flatMap((s) => s.exchanges.flatMap((ex) => (ex.slots[slot] ? [ex.slots[slot]] : []))))];
    if (groups.length > 1) {
      errors.push(`reactions: "${id}" answers slot "${slot}", which draws from ${groups.sort().join(" and ")}; give one of them another slot name`);
    }
  }

  if (checks.coverage) {
    const stagesUsed = new Set(course.scenes.map((s) => String(s.stage)));
    for (const stage of stagesUsed) {
      const levels = new Set(stages[stage] ?? []);
      for (const word of Object.values(course.words)) {
        if (word.bonus || !levels.has(word.lv)) continue;
        const n = scenesUsing.get(word.id)?.size ?? 0;
        if (n < MIN_SCENES_PER_WORD) errors.push(`coverage: "${word.w}" (stage ${stage}) is in ${n} scenes; needs ${MIN_SCENES_PER_WORD}`);
      }
    }
  }

  for (const name of Object.keys(course.concepts)) {
    if (!(name in course.conceptNames)) errors.push(`concepts: no learner-language name for "${name}"`);
  }
  for (const d of dupes(course.notes.map((n) => n.id))) errors.push(`notes: id "${d}" is used twice`);
  for (const n of course.notes) {
    if ("word" in n.trigger && !course.words[n.trigger.word]) errors.push(`notes: "${n.id}" is triggered by unknown word "${n.trigger.word}"`);
    if ("scene" in n.trigger && !sceneIds.has(n.trigger.scene)) errors.push(`notes: "${n.id}" is triggered by unknown scene "${n.trigger.scene}"`);
  }
  if (world.mentor) {
    if (!world.npcs[world.mentor.npc]) errors.push(`world: mentor "${world.mentor.npc}" is not an npc`);
    if (!sceneIds.has(world.mentor.after)) errors.push(`world: mentor comes after unknown scene "${world.mentor.after}"`);
  }

  // Every action says what was asked after a wrong reply (asked-<action>), so no scene falls back
  // to the generic line.
  const actionScene = new Map<string, string>();
  for (const s of course.scenes) for (const ex of s.exchanges) if (!actionScene.has(ex.expect.action)) actionScene.set(ex.expect.action, s.id);
  for (const [action, scene] of actionScene) {
    if (!learnerIds.has(`asked-${action}`)) errors.push(`narration: no "asked-${action}" line (used by ${scene})`);
  }

  const need = [
    ...input.requiredUi,
    ...course.notes.flatMap((n) => [`note-${n.id}`, `note-${n.id}-title`]),
    ...Object.keys(world.places).map((p) => `place-${p}`),
    ...Object.keys(world.places).map((p) => `place-${p}-desc`),
    ...Object.keys(world.npcs).map((n) => `npc-${n}`),
    ...course.scenes.map((s) => `scene-${s.id}`),
  ];
  for (const id of need) if (!learnerIds.has(id)) errors.push(`learner text: missing "${id}"`);
  if (checks.audio) errors.push(...audioProblems(course, input.audioFiles ?? new Set()));

  return errors;
}

/** The helper's content contract; no new required fields for older courses. */
export function voiceProblems(course: Course, learnerIds: ReadonlySet<string>, whyIds: ReadonlySet<string> = new Set()): string[] {
  const errors: string[] = [];
  const exchanges = new Set(course.scenes.flatMap((s) => s.exchanges.map((e) => `${s.id}.${e.id}-why`)));
  for (const id of whyIds) if (!exchanges.has(id)) errors.push(`voice: explanation "${id}" has no exchange`);
  if (!voiceOn(course)) return errors;
  const t = makeText(course.learnerFtl, course.learner);
  const bundle = new FluentBundle(course.learner, { useIsolating: false });
  bundle.addResource(new FluentResource(course.learnerFtl));
  const longest = (values: string[]) => values.sort((a, b) => [...b].length - [...a].length)[0] ?? "";
  const variants = course.scenes.flatMap((s) => s.exchanges.flatMap((e) => Object.values(e.variants)));
  const npc = longest(Object.keys(course.world.npcs).flatMap((id) => [t(`npc-${id}`), ...(t.has(`npc-${id}-unmet`) ? [t(`npc-${id}-unmet`)] : [])]));
  const base = { wallet: 999999, currency: course.world.currency };
  const fragments = (prefix: string) => [...learnerIds].filter((id) => id.startsWith(prefix)).map((id) => t(id, base));
  const vars: Record<string, string | number> = {
    ...Object.fromEntries(VOICE_VARS.map((v) => [v, "x"])), ...base, day: 999, known: Object.keys(course.words).length, hunger: 1,
    npc, npcShort: npcShort(npc),
    asked: longest(variants.map((v) => voiceAsked((v as typeof v & { why?: string }).why ?? v.npc.meaning ?? ""))),
    word: longest(Object.values(course.words).map((w) => w.w)), gloss: longest(Object.values(course.words).map((w) => voiceGloss(displayGloss(w)))),
    wordMeaning: longest(Object.values(course.words).flatMap((w) => [w.w, ...Object.keys(w.forms ?? {})].map((surface) => voiceWord(w, surface, t)))),
    shape: longest(variants.map((v) => t("voice-shape-intent", { intent: voiceIntent(v.reply.intent ?? "answer what was asked") }))),
    memory: t("voice-memory-used", { npcShort: npcShort(npc) }),
    situation: longest(fragments("voice-situation-")), reflection: longest(fragments("voice-reflection-")),
    rule: longest(fragments("voice-rule-")), paper: longest(["idcard", "newspaper", "bill"].map((id) => t(`voice-paper-${id}`))),
  };
  for (const w of Object.values(course.words)) {
    const gloss = voiceGloss(displayGloss(w));
    if (/[?!;]$/.test(gloss) || gloss.includes(";")) errors.push(`voice: unsafe gloss for ${w.id}`);
  }
  for (const pool of VOICE_POOLS) {
    const ids = [...learnerIds].filter((id) => new RegExp(`^voice-${pool}-[0-9]+$`).test(id));
    if (ids.length < 4) errors.push(`voice: ${pool} needs at least 4 variants`);
    for (let n = 1; n <= ids.length; n++) if (!learnerIds.has(`voice-${pool}-${n}`)) errors.push(`voice: ${pool} variants must be contiguous from 1`);
    for (const id of ids) {
      const rendered = t(id, vars);
      if (/[?!]\./.test(rendered)) errors.push(`voice: ${id} joins gloss punctuation incorrectly`);
      if ([...rendered].length > VOICE_LIMIT) errors.push(`voice: ${id} exceeds ${VOICE_LIMIT} characters`);
      const value = bundle.getMessage(id)?.value;
      if (value) { const problems: Error[] = []; bundle.formatPattern(value, vars, problems); for (const e of problems) errors.push(`voice: ${id}: ${e.message}`); }
    }
  }
  for (const scene of course.scenes) for (const ex of scene.exchanges) for (const v of Object.values(ex.variants)) {
    const why = (v as typeof v & { why?: string }).why;
    if (why && [...why].length > VOICE_LIMIT) errors.push(`voice: ${scene.id}.${ex.id}-why exceeds ${VOICE_LIMIT} characters`);
  }
  return errors;
}
