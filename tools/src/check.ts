import type { Course, RenderedLine, Scene, WordId } from "@silver-tongue/core";

export interface CheckInput {
  course: Course;
  /** stage number -> pack levels it covers */
  stages: Record<string, string[]>;
  checks: { coverage: boolean; audio: boolean };
  /** message ids available in the learner-language files */
  learnerIds: Set<string>;
  /** message ids the front ends need */
  requiredUi: string[];
}

export const MAX_NEW_PER_EXCHANGE = 2;
export const MIN_SCENES_PER_WORD = 3;
/** Every choice is one key, 1-9: a reply's tiles are its words plus up to 2 extra. */
export const MAX_REPLY_WORDS = 7;
/** Word help offers each word of the NPC's line on keys 1-9. */
export const MAX_LINE_WORDS = 9;
/** A place's menu: its scenes and exits on keys 1-7, then sleep and quit. */
export const MAX_PLACE_ITEMS = 7;

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

const lineWords = (l: RenderedLine | undefined): WordId[] => (l ? l.tokens.map((t) => t.word) : []);

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
  }
  for (const [id, p] of Object.entries(world.places)) {
    const items = p.links.length + course.scenes.filter((s) => s.place === id).length;
    if (items > MAX_PLACE_ITEMS) errors.push(`world: place "${id}" has ${items} scenes and exits; at most ${MAX_PLACE_ITEMS}`);
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
    for (const ex of s.exchanges) {
      for (const k of ["pay", "missCost"] as const) {
        if (!isCount(ex[k])) errors.push(`${s.id}/${ex.id}: ${k} must be a whole number of 0 or more`);
      }
      for (const slot of Object.keys(ex.slots)) {
        if (!NAME.test(slot)) errors.push(`${s.id}/${ex.id}: slot "${slot}" may only use letters, digits, _ and -`);
      }
      for (const v of Object.values(ex.expect)) {
        if (v.startsWith("$") && !(v.slice(1) in ex.slots)) errors.push(`${s.id}/${ex.id}: expect uses unknown slot "${v}"`);
      }
      for (const h of ex.hinges) {
        const ok = h.startsWith("$") ? h.slice(1) in ex.slots : h in course.concepts;
        if (!ok) errors.push(`${s.id}/${ex.id}: unknown hinge "${h}"`);
      }
    }
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
    for (const ex of s.exchanges) {
      const exWords = new Set<WordId>();
      for (const [key, v] of Object.entries(ex.variants)) {
        const where = `${s.id}/${ex.id}${key ? `[${key}]` : ""}`;
        const words = [...lineWords(v.npc), ...lineWords(v.reply), ...lineWords(v.rephrase)];
        const fresh = [...new Set(words)].filter((w) => !seen.has(w));
        if (fresh.length > MAX_NEW_PER_EXCHANGE) {
          const shown = fresh.map((w) => course.words[w]?.w ?? w).join(" ");
          errors.push(`${where}: ${fresh.length} new words (${shown}); at most ${MAX_NEW_PER_EXCHANGE}`);
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
          if (alt.tokens.length > MAX_REPLY_WORDS) errors.push(`${where}: the wrong reply "${alt.text}" has ${alt.tokens.length} words; at most ${MAX_REPLY_WORDS}`);
        }
        if (v.reply.tokens.length > MAX_REPLY_WORDS) {
          errors.push(`${where}: the reply has ${v.reply.tokens.length} words; at most ${MAX_REPLY_WORDS}`);
        }
        for (const [name, l] of [["npc", v.npc], ["rephrase", v.rephrase]] as const) {
          if (l && l.tokens.length > MAX_LINE_WORDS) {
            errors.push(`${where}: the ${name} line has ${l.tokens.length} words; at most ${MAX_LINE_WORDS}`);
          }
        }
        if (checks.audio) {
          for (const [name, l] of Object.entries(v)) if (l && !l.audio) errors.push(`${where}: ${name} line has no audio`);
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
    if (checks.audio && !l.audio) errors.push(`reaction ${id}: no audio`);
  }
  if (!course.reactions["wrong-generic"]) errors.push(`reactions: "wrong-generic" is required`);

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

  const need = [
    ...input.requiredUi,
    ...course.notes.flatMap((n) => [`note-${n.id}`, `note-${n.id}-title`]),
    ...Object.keys(world.places).map((p) => `place-${p}`),
    ...Object.keys(world.places).map((p) => `place-${p}-desc`),
    ...Object.keys(world.npcs).map((n) => `npc-${n}`),
    ...course.scenes.map((s) => `scene-${s.id}`),
  ];
  for (const id of need) if (!learnerIds.has(id)) errors.push(`learner text: missing "${id}"`);

  return errors;
}
