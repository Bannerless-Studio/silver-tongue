import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allCombos,
  comboKey,
  type Course,
  type Exchange,
  type Note,
  PLAYER_MARK,
  type RenderedLine,
  type Scene,
  type Variant,
  type Word,
  type World,
} from "@silver-tongue/core";
import { narrationProblems, uiTextProblems } from "@silver-tongue/tui";
import { checkCourse } from "./check";
import { bindSlots, messageIds, parseFtl, Renderer, termNames, type FtlSource } from "./fluent";
import type { PackMeta, PackWord } from "./pack";
import { buildLexicon, segment, type Lexicon } from "./segment";

interface CourseConfig {
  id: string;
  language: string;
  setting: string;
  learner: string;
  checks: { coverage: boolean; audio: boolean };
}

interface GroupsJson {
  groups: Record<string, string[]>;
  numbers?: Record<string, number>;
}

type ExchangeSkeleton = Omit<Exchange, "variants">;
type SceneSkeleton = Omit<Scene, "exchanges"> & { exchanges: ExchangeSkeleton[] };

export interface BuildResult {
  /** undefined when a problem stopped the build before a course could be put together */
  course: Course | undefined;
  errors: string[];
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const readOptional = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

/** Builds a course from content/. Never throws: every problem becomes an error line. */
export function buildCourse(root: string, courseId: string): BuildResult {
  const errors: string[] = [];
  /** Runs one step; a throw becomes an error named after the step. */
  const attempt = <T>(where: string, step: () => T): T | undefined => {
    try {
      return step();
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      return undefined;
    }
  };
  const stop = (): BuildResult => ({ course: undefined, errors });

  const cfg = attempt(`courses/${courseId}.json`, () => readJson<CourseConfig>(join(root, "courses", `${courseId}.json`)));
  if (!cfg) return stop();
  const langDir = join(root, "languages", cfg.language);
  const learnerDir = join(root, "learner", cfg.learner);
  const settingDir = join(root, "settings", cfg.setting);

  const meta = attempt("pack.json", () => readJson<PackMeta>(join(langDir, "pack.json")));
  if (!meta) return stop();
  if (meta.spaced) {
    errors.push(`language "${meta.key}" separates words with spaces; its tagger is not built yet`);
    return stop();
  }
  const packWords = attempt("words", () => {
    const extraPath = join(langDir, "extra-words.json");
    const extra = existsSync(extraPath) ? readJson<PackWord[]>(extraPath).map((w) => ({ ...w, bonus: true })) : [];
    // bonus.json: pack words above the stage that the course may use anyway, e.g. 面条 at a noodle shop.
    const bonusPath = join(langDir, "bonus.json");
    const bonusIds = new Set(existsSync(bonusPath) ? readJson<string[]>(bonusPath) : []);
    const pack = readJson<PackWord[]>(join(langDir, "words.json")).map((w) => (bonusIds.has(w.id) ? { ...w, bonus: true } : w));
    for (const id of bonusIds) if (!pack.some((w) => w.id === id)) throw new Error(`bonus.json: unknown word id "${id}"`);
    return [...pack, ...extra];
  });
  const lex: Lexicon | undefined = packWords && attempt("words", () => buildLexicon(packWords));
  if (!packWords || !lex) return stop();

  const toLine = (text: string, where: string): RenderedLine => {
    const { tokens, unknown } = segment(text, lex);
    if (unknown.length) errors.push(`${where}: "${text}" has characters outside the word list: ${unknown.map((u) => u.char).join(" ")}`);
    return { text, tokens };
  };

  const glossSrc: FtlSource[] = [`glosses-${cfg.language}.ftl`, `glosses-${cfg.language}-extra.ftl`].map((f) => [
    f,
    readOptional(join(learnerDir, f)),
  ]);
  const glosses = attempt("glosses", () => new Renderer(cfg.learner, glossSrc));
  const words: Record<string, Word> = {};
  for (const w of packWords) {
    if (glosses && !glosses.has(w.id)) errors.push(`glosses: no ${cfg.learner} gloss for ${w.id} "${w.w}"`);
    words[w.id] = {
      id: w.id,
      w: w.w,
      lv: w.lv,
      gloss: glosses?.has(w.id) ? glosses.render(w.id) : "",
      ...(w.pron ? { pron: w.pron } : {}),
      ...(w.bonus ? { bonus: true } : {}),
    };
  }

  const termsSrc = attempt("terms.ftl", () => {
    const src = readFileSync(join(langDir, "terms.ftl"), "utf8");
    parseFtl(src, "terms.ftl");
    return src;
  });
  if (termsSrc === undefined) return stop();
  const concepts: Record<string, string[]> = {};
  for (const name of termNames(termsSrc, "terms.ftl")) {
    const text = attempt(`term -${name}`, () =>
      new Renderer(meta.locale, [["terms.ftl", termsSrc], ["concept", `concept = { -${name} }`]]).render("concept"),
    );
    if (text !== undefined) concepts[name] = toLine(text, `term -${name}`).tokens.map((t) => t.word);
  }

  // Meanings: what each line says, in the learner's language. Concepts get learner-language
  // terms, and slots bind to them the same way as in the language being learned.
  const meaningTermsName = `learner/${cfg.learner}/terms.ftl`;
  const meaningTerms = attempt(meaningTermsName, () => {
    const src = readFileSync(join(learnerDir, "terms.ftl"), "utf8");
    parseFtl(src, meaningTermsName);
    return src;
  });
  const meaningsDir = join(learnerDir, `lines-${cfg.language}`);

  const setting = attempt(`settings/${cfg.setting}`, () => ({
    ...readJson<GroupsJson>(join(settingDir, "groups.json")),
    world: readJson<World>(join(settingDir, "world.json")),
  }));
  if (!setting) return stop();
  const { groups, numbers = {}, world } = setting;

  const scenesDir = join(settingDir, "scenes");
  const scenes: Scene[] = [];
  const sceneFiles = attempt("scenes", () => readdirSync(scenesDir).filter((f) => f.endsWith(".json")).sort()) ?? [];
  for (const file of sceneFiles) {
    const sk = attempt(`scenes/${file}`, () => readJson<SceneSkeleton>(join(scenesDir, file)));
    if (!sk) continue;
    const linesPath = join(langDir, "lines", `${sk.id}.ftl`);
    const linesName = `lines/${sk.id}.ftl`;
    if (!existsSync(linesPath)) {
      errors.push(`${sk.id}: no ${cfg.language} lines (${linesPath})`);
      continue;
    }
    // A syntax error is reported once here, not once per slot combination.
    const linesSrc = attempt(sk.id, () => {
      const src = readFileSync(linesPath, "utf8");
      parseFtl(src, linesName);
      return src;
    });
    if (linesSrc === undefined) continue;
    const meaningsPath = join(meaningsDir, `${sk.id}.ftl`);
    const meaningsName = `learner/${cfg.learner}/lines-${cfg.language}/${sk.id}.ftl`;
    if (!existsSync(meaningsPath)) errors.push(`${sk.id}: no ${cfg.learner} meanings (${meaningsPath})`);
    const meaningsSrc =
      meaningTerms === undefined || !existsSync(meaningsPath)
        ? undefined
        : attempt(sk.id, () => {
            const src = readFileSync(meaningsPath, "utf8");
            parseFtl(src, meaningsName);
            return src;
          });
    const exchanges: Exchange[] = [];
    for (const ex of sk.exchanges) {
      const variants: Record<string, Variant> = {};
      const unknownGroups = Object.values(ex.slots).filter((g) => !groups[g]);
      if (unknownGroups.length) {
        errors.push(`${sk.id}/${ex.id}: unknown group ${unknownGroups.map((g) => `"${g}"`).join(", ")}`);
        continue;
      }
      if (typeof ex.cost === "string") {
        const group = ex.cost.startsWith("$") ? ex.slots[ex.cost.slice(1)] : undefined;
        if (!group || !groups[group].every((c) => c in numbers)) {
          errors.push(`${sk.id}/${ex.id}: cost "${ex.cost}" must be a number or a slot whose values are all numbers`);
        }
      }
      for (const combo of allCombos(ex.slots, groups)) {
        const where = `${sk.id}/${ex.id}${Object.keys(combo).length ? `[${comboKey(combo)}]` : ""}`;
        // $player renders as the mark; the core puts the player's name in at play time.
        const args: Record<string, string | number> = { player: PLAYER_MARK };
        for (const [slot, concept] of Object.entries(combo)) if (concept in numbers) args[slot] = numbers[concept];
        attempt(where, () => {
          const r = new Renderer(meta.locale, [
            ["terms.ftl", termsSrc],
            ["slots", bindSlots(termsSrc, combo, linesSrc, linesName)],
            [linesName, linesSrc],
          ]);
          const variant: Variant = {
            npc: toLine(r.render(ex.id, args), where),
            reply: toLine(r.render(`${ex.id}-reply`, args), where),
          };
          if (r.has(`${ex.id}-rephrase`)) variant.rephrase = toLine(r.render(`${ex.id}-rephrase`, args), where);
          const altIds = [1, 2, 3].map((n) => `${ex.id}-alt${n}`).filter((id) => r.has(id));
          if (altIds.length) variant.alts = altIds.map((id) => toLine(r.render(id, args), where));
          variants[comboKey(combo)] = variant;
          if (typeof ex.cost === "number") variant.cost = ex.cost;
          else if (typeof ex.cost === "string" && ex.cost.startsWith("$") && combo[ex.cost.slice(1)] in numbers) {
            variant.cost = numbers[combo[ex.cost.slice(1)]];
          }
          if (meaningsSrc === undefined || meaningTerms === undefined) return;
          attempt(`${where} (${cfg.learner} meaning)`, () => {
            const m = new Renderer(cfg.learner, [
              [meaningTermsName, meaningTerms],
              ["slots", bindSlots(meaningTerms, combo, meaningsSrc, meaningsName, meaningTermsName)],
              [meaningsName, meaningsSrc],
            ]);
            variant.npc.meaning = m.render(ex.id, args);
            variant.reply.meaning = m.render(`${ex.id}-reply`, args);
            if (variant.rephrase) variant.rephrase.meaning = m.render(`${ex.id}-rephrase`, args);
            variant.alts?.forEach((l, i) => (l.meaning = m.render(`${ex.id}-alt${i + 1}`, args)));
          });
        });
      }
      exchanges.push({ ...ex, variants });
    }
    scenes.push({ ...sk, exchanges });
  }

  const reactions: Record<string, RenderedLine> = {};
  attempt("reactions.ftl", () => {
    const src = readFileSync(join(langDir, "reactions.ftl"), "utf8");
    const r = new Renderer(meta.locale, [["terms.ftl", termsSrc], ["reactions.ftl", src]]);
    const meaningsName = `learner/${cfg.learner}/reactions-${cfg.language}.ftl`;
    const m = attempt(meaningsName, () => new Renderer(cfg.learner, [[meaningsName, readFileSync(join(learnerDir, `reactions-${cfg.language}.ftl`), "utf8")]]));
    for (const id of messageIds(src, "reactions.ftl")) {
      const text = attempt(`reaction ${id}`, () => r.render(id));
      if (text === undefined) continue;
      reactions[id] = toLine(text, `reaction ${id}`);
      if (m) attempt(`reaction ${id} (${cfg.learner} meaning)`, () => (reactions[id].meaning = m.render(id)));
    }
  });

  // Concept names for narration: each concept's base form in the learner's language.
  const conceptNames: Record<string, string> = {};
  if (meaningTerms !== undefined) {
    for (const name of Object.keys(concepts)) {
      const r = attempt(`${meaningTermsName} -${name}`, () =>
        new Renderer(cfg.learner, [[meaningTermsName, meaningTerms], ["name", `name = { -${name} }`]]),
      );
      if (r) {
        try {
          conceptNames[name] = r.render("name");
        } catch {
          // no learner term: the checker reports the missing name
        }
      }
    }
  }
  // Every word on each stage's levels: the list the notebook counts progress toward.
  const stageWords = Object.fromEntries(
    Object.entries(meta.stages).map(([stage, levels]) => [
      stage,
      packWords.filter((w) => !w.bonus && levels.includes(w.lv)).map((w) => w.id),
    ]),
  );
  const notesPath = join(langDir, "notes.json");
  const notes = (existsSync(notesPath) && attempt("notes.json", () => readJson<Note[]>(notesPath))) || [];

  const learnerFtl =
    attempt(`learner/${cfg.learner}`, () =>
      [
        readFileSync(join(learnerDir, "ui.ftl"), "utf8"),
        readFileSync(join(learnerDir, `narration-${cfg.setting}.ftl`), "utf8"),
        readOptional(join(learnerDir, `mentor-${cfg.language}.ftl`)),
      ].join("\n"),
    ) ?? "";

  const course: Course = {
    id: cfg.id,
    typing: meta.typing !== null,
    words,
    concepts,
    groups,
    world,
    scenes,
    reactions,
    learnerFtl,
    conceptNames,
    stageWords,
    notes,
    needsName: scenes.some((s) =>
      s.exchanges.some((ex) =>
        Object.values(ex.variants).some((v) => [v.npc, v.reply, v.rephrase, ...(v.alts ?? [])].some((l) => l?.text.includes(PLAYER_MARK))),
      ),
    ),
  };
  const learnerIds = attempt("learner text", () => new Set(messageIds(learnerFtl, "learner files"))) ?? new Set<string>();
  errors.push(...checkCourse({ course, stages: meta.stages, checks: cfg.checks, learnerIds, requiredUi: [] }));
  errors.push(...uiTextProblems(learnerFtl, cfg.learner));
  // Each action's narration gets the parameters its exchanges' `expect` gives it.
  const actions: Record<string, string[]> = {};
  for (const ex of scenes.flatMap((s) => s.exchanges)) {
    const name = ex.expect.action;
    if (name) actions[name] = [...new Set([...(actions[name] ?? []), ...Object.keys(ex.expect).filter((k) => k !== "action")])];
  }
  errors.push(...narrationProblems(learnerFtl, cfg.learner, actions));
  // Ship only the words the course uses: rank is the share of these that are known, and
  // the pack has far more words than one course needs. (The checks above see the whole pack.)
  const used = new Set<string>([
    ...Object.values(concepts).flat(),
    ...Object.values(reactions).flatMap((l) => l.tokens.map((t) => t.word)),
    ...scenes.flatMap((s) =>
      s.exchanges.flatMap((ex) =>
        Object.values(ex.variants).flatMap((v) =>
          [v.npc, v.reply, v.rephrase, ...(v.alts ?? [])].flatMap((l) => l?.tokens.map((t) => t.word) ?? []),
        ),
      ),
    ),
  ]);
  course.words = Object.fromEntries(Object.entries(words).filter(([id]) => used.has(id)));
  return { course, errors };
}

function main(): void {
  const courseId = process.argv[2] ?? "zh-china-en";
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { course, errors } = buildCourse(join(repo, "content"), courseId);
  if (!course || errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`${errors.length} error(s); course not written`);
    process.exit(1);
  }
  const outDir = join(repo, "dist", "courses", courseId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "course.json"), JSON.stringify(course));
  console.log(`built ${courseId}: ${course.scenes.length} scenes -> ${join(outDir, "course.json")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
