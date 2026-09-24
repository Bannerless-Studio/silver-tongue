import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allCombos,
  comboKey,
  type Course,
  type Exchange,
  type RenderedLine,
  type Scene,
  type Variant,
  type Word,
  type World,
} from "@silver-tongue/core";
import { uiTextProblems } from "@silver-tongue/tui";
import { checkCourse } from "./check";
import { bindSlots, messageIds, Renderer, termNames, type FtlSource } from "./fluent";
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
  course: Course;
  errors: string[];
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const readOptional = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

export function buildCourse(root: string, courseId: string): BuildResult {
  const errors: string[] = [];
  const cfg = readJson<CourseConfig>(join(root, "courses", `${courseId}.json`));
  const langDir = join(root, "languages", cfg.language);
  const learnerDir = join(root, "learner", cfg.learner);
  const settingDir = join(root, "settings", cfg.setting);

  const meta = readJson<PackMeta>(join(langDir, "pack.json"));
  if (meta.spaced) throw new Error(`language "${meta.key}" separates words with spaces; its tagger is not built yet`);
  const extraPath = join(langDir, "extra-words.json");
  const extra = existsSync(extraPath) ? readJson<PackWord[]>(extraPath).map((w) => ({ ...w, bonus: true })) : [];
  const packWords = [...readJson<PackWord[]>(join(langDir, "words.json")), ...extra];
  const lex: Lexicon = buildLexicon(packWords);

  const toLine = (text: string, where: string): RenderedLine => {
    const { tokens, unknown } = segment(text, lex);
    if (unknown.length) errors.push(`${where}: "${text}" has characters outside the word list: ${unknown.map((u) => u.char).join(" ")}`);
    return { text, tokens };
  };

  const glossSrc: FtlSource[] = [`glosses-${cfg.language}.ftl`, `glosses-${cfg.language}-extra.ftl`].map((f) => [
    f,
    readOptional(join(learnerDir, f)),
  ]);
  const glosses = new Renderer(cfg.learner, glossSrc);
  const words: Record<string, Word> = {};
  for (const w of packWords) {
    if (!glosses.has(w.id)) errors.push(`glosses: no ${cfg.learner} gloss for ${w.id} "${w.w}"`);
    words[w.id] = {
      id: w.id,
      w: w.w,
      lv: w.lv,
      gloss: glosses.has(w.id) ? glosses.render(w.id) : "",
      ...(w.pron ? { pron: w.pron } : {}),
      ...(w.bonus ? { bonus: true } : {}),
    };
  }

  const termsSrc = readFileSync(join(langDir, "terms.ftl"), "utf8");
  const concepts: Record<string, string[]> = {};
  for (const name of termNames(termsSrc, "terms.ftl")) {
    const text = new Renderer(meta.locale, [["terms.ftl", termsSrc], ["concept", `concept = { -${name} }`]]).render("concept");
    concepts[name] = toLine(text, `term -${name}`).tokens.map((t) => t.word);
  }

  const { groups, numbers = {} } = readJson<GroupsJson>(join(settingDir, "groups.json"));
  const world = readJson<World>(join(settingDir, "world.json"));

  const scenesDir = join(settingDir, "scenes");
  const scenes: Scene[] = [];
  for (const file of readdirSync(scenesDir).filter((f) => f.endsWith(".json")).sort()) {
    const sk = readJson<SceneSkeleton>(join(scenesDir, file));
    const linesPath = join(langDir, "lines", `${sk.id}.ftl`);
    if (!existsSync(linesPath)) {
      errors.push(`${sk.id}: no ${cfg.language} lines (${linesPath})`);
      continue;
    }
    const linesSrc = readFileSync(linesPath, "utf8");
    const linesName = `lines/${sk.id}.ftl`;
    const exchanges: Exchange[] = [];
    for (const ex of sk.exchanges) {
      const variants: Record<string, Variant> = {};
      const unknownGroups = Object.values(ex.slots).filter((g) => !groups[g]);
      if (unknownGroups.length) {
        errors.push(`${sk.id}/${ex.id}: unknown group ${unknownGroups.map((g) => `"${g}"`).join(", ")}`);
        continue;
      }
      for (const combo of allCombos(ex.slots, groups)) {
        const where = `${sk.id}/${ex.id}${Object.keys(combo).length ? `[${comboKey(combo)}]` : ""}`;
        const args: Record<string, number> = {};
        for (const [slot, concept] of Object.entries(combo)) if (concept in numbers) args[slot] = numbers[concept];
        try {
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
          variants[comboKey(combo)] = variant;
        } catch (e) {
          errors.push(`${where}: ${(e as Error).message}`);
        }
      }
      exchanges.push({ ...ex, variants });
    }
    scenes.push({ ...sk, exchanges });
  }

  const reactionsSrc = readFileSync(join(langDir, "reactions.ftl"), "utf8");
  const reactionRenderer = new Renderer(meta.locale, [["terms.ftl", termsSrc], ["reactions.ftl", reactionsSrc]]);
  const reactions: Record<string, RenderedLine> = {};
  for (const id of messageIds(reactionsSrc, "reactions.ftl")) {
    reactions[id] = toLine(reactionRenderer.render(id), `reaction ${id}`);
  }

  const learnerFtl = [
    readFileSync(join(learnerDir, "ui.ftl"), "utf8"),
    readFileSync(join(learnerDir, `narration-${cfg.setting}.ftl`), "utf8"),
  ].join("\n");

  const course: Course = { id: cfg.id, typing: meta.typing !== null, words, concepts, groups, world, scenes, reactions, learnerFtl };
  errors.push(
    ...checkCourse({
      course,
      stages: meta.stages,
      checks: cfg.checks,
      learnerIds: new Set(messageIds(learnerFtl, "learner files")),
      requiredUi: [],
    }),
  );
  errors.push(...uiTextProblems(learnerFtl, cfg.learner));
  return { course, errors };
}

function main(): void {
  const courseId = process.argv[2] ?? "zh-china-en";
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { course, errors } = buildCourse(join(repo, "content"), courseId);
  if (errors.length) {
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
