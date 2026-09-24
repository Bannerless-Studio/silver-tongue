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

/** Scenes in `after` order; ties keep file order. */
export function orderScenes(scenes: Scene[]): { ordered: Scene[]; errors: string[] } {
  const done = new Set<string>();
  const ordered: Scene[] = [];
  const pending = [...scenes];
  while (pending.length) {
    const i = pending.findIndex((s) => s.after.every((a) => done.has(a)));
    if (i < 0) return { ordered, errors: [`scene order has a cycle or a missing scene: ${pending.map((s) => s.id).join(", ")}`] };
    const [s] = pending.splice(i, 1);
    ordered.push(s);
    done.add(s.id);
  }
  return { ordered, errors: [] };
}

const lineWords = (l: RenderedLine | undefined): WordId[] => (l ? l.tokens.map((t) => t.word) : []);

export function checkCourse(input: CheckInput): string[] {
  const { course, stages, checks, learnerIds } = input;
  const errors: string[] = [];
  const { world } = course;

  if (!world.places[world.start]) errors.push(`world: start place "${world.start}" does not exist`);
  for (const [id, p] of Object.entries(world.places)) {
    for (const l of p.links) if (!world.places[l]) errors.push(`world: place "${id}" links to unknown place "${l}"`);
  }
  for (const [id, n] of Object.entries(world.npcs)) {
    if (!world.places[n.place]) errors.push(`world: npc "${id}" is at unknown place "${n.place}"`);
  }

  const sceneIds = new Set(course.scenes.map((s) => s.id));
  for (const s of course.scenes) {
    if (!world.places[s.place]) errors.push(`${s.id}: unknown place "${s.place}"`);
    if (!world.npcs[s.npc]) errors.push(`${s.id}: unknown npc "${s.npc}"`);
    for (const a of s.after) if (!sceneIds.has(a)) errors.push(`${s.id}: after unknown scene "${a}"`);
    for (const npc of Object.keys(s.requires.trust ?? {})) {
      if (!world.npcs[npc]) errors.push(`${s.id}: requires trust with unknown npc "${npc}"`);
    }
    for (const ex of s.exchanges) {
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
  const seen = new Set<WordId>();
  const scenesUsing = new Map<WordId, Set<string>>();
  for (const s of ordered) {
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
  }

  const maxStage = Math.max(1, ...course.scenes.map((s) => s.stage));
  for (const [id, l] of Object.entries(course.reactions)) {
    checkLevels(`reaction ${id}`, lineWords(l), maxStage);
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

  const need = [
    ...input.requiredUi,
    ...Object.keys(world.places).map((p) => `place-${p}`),
    ...Object.keys(world.places).map((p) => `place-${p}-desc`),
    ...Object.keys(world.npcs).map((n) => `npc-${n}`),
    ...course.scenes.map((s) => `scene-${s.id}`),
  ];
  for (const id of need) if (!learnerIds.has(id)) errors.push(`learner text: missing "${id}"`);

  return errors;
}
