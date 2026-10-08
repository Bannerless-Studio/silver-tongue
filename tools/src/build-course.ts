import { artProblems } from "./art";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allCombos,
  type AltOutcome,
  type CatalogEntry,
  comboKey,
  type Course,
  type Exchange,
  type Note,
  PLAYER_MARK,
  type RenderedLine,
  type Scene,
  type Variant,
  type World,
} from "@silver-tongue/core";
import { heuristicGloss, narrationProblems, uiTextProblems } from "@silver-tongue/tui";
import type { CourseExtra, DeskPaper, LetterChart, WordExtra } from "@silver-tongue/view";
import { checkCourse, usedWords } from "./check";
import { bindSlots, duplicateIds, messageIds, parseFtl, Renderer, termNames, type FtlSource } from "./fluent";
import type { PackMeta, PackWord } from "./pack";
import { assignLetterAudio, letterMessageIds, letterProblems } from "./letters";
import { assignPaperAudio, paperMessageIds, paperProblems } from "./papers";
import { buildLexicon, segmentMarked, type Lexicon } from "./segment";
import { learningCheck } from "./learning";
import { taggingLines, taggingPath } from "./tagging";
import { assignAudio, voiceProblems, type Clip, type Voices } from "./voices";

export interface CourseConfig {
  id: string;
  language: string;
  setting: string;
  /** reading languages, the default first */
  learners: string[];
  /** earlier ids whose saves this course loads */
  aliases?: string[];
  /**
   * coverage: every word of a stage in MIN_SCENES_PER_WORD scenes. `true` checks every stage the
   * scenes reach, a list only those stages (the finished ones; a stage still being written would fail).
   */
  checks: { coverage: boolean | number[]; audio: boolean; art?: boolean };
}

interface GroupsJson {
  groups: Record<string, string[]>;
  numbers?: Record<string, number>;
}

/**
 * `alts` marks written wrong replies (by their Fluent number: "1" is `<id>-alt1`) that get the
 * player through the exchange, with what they pay and lose. Their NPC answers are Fluent lines
 * (`<id>-alt<n>-answer`), so the skeleton only says what a reply does.
 */
type ExchangeSkeleton = Omit<Exchange, "variants"> & { alts?: Record<string, { accept?: boolean; pay?: number; loss?: number }> };
/** `newWords` overrides the checker's ratio-based new-word limit for this scene; tools-only, stripped before the course is built. */
type SceneSkeleton = Omit<Scene, "exchanges"> & { exchanges: ExchangeSkeleton[]; newWords?: number };

export interface BuildResult {
  /** undefined when a problem stopped the build before a course could be put together */
  course: Course | undefined;
  errors: string[];
  /** problems worth fixing that don't stop the build or fail the course, e.g. a missing curated gloss */
  warnings: string[];
  /** every clip the course needs, once each */
  clips: Clip[];
  /** where the clip files live: content/audio/<language> */
  audioDir: string | undefined;
  /** the setting folder holding art.json and art/, when it has art */
  artDir: string | undefined;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const readOptional = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

/** Builds a course from content/. Never throws: every problem becomes an error line. */
export function buildCourse(root: string, courseId: string, learnerCode?: string): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  /** Runs one step; a throw becomes an error named after the step. */
  const attempt = <T>(where: string, step: () => T): T | undefined => {
    try {
      return step();
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
      return undefined;
    }
  };
  const stop = (): BuildResult => ({ course: undefined, errors, warnings, clips: [], audioDir: undefined, artDir: undefined });

  const cfg = attempt(`courses/${courseId}.json`, () => readJson<CourseConfig>(join(root, "courses", `${courseId}.json`)));
  if (!cfg) return stop();
  if (cfg.id !== courseId) {
    errors.push(`courses/${courseId}.json: id "${cfg.id}" must match the file name`);
    return stop();
  }
  if (!hasLearners(cfg)) {
    errors.push(`courses/${courseId}.json: ${NO_LEARNERS}`);
    return stop();
  }
  const learner = learnerCode ?? cfg.learners[0];
  if (!cfg.learners.includes(learner)) {
    errors.push(`courses/${courseId}.json: "${learner}" is not in learners`);
    return stop();
  }
  const langDir = join(root, "languages", cfg.language);
  const learnerDir = join(root, "learner", learner);
  const settingDir = join(root, "settings", cfg.setting);

  const meta = attempt("pack.json", () => readJson<PackMeta>(join(langDir, "pack.json")));
  if (!meta) return stop();
  if (meta.spaced) {
    errors.push(`language "${meta.key}" separates words with spaces; its tagger is not built yet`);
    return stop();
  }
  if (meta.direction === "rtl") {
    errors.push(`language "${meta.key}" is written right to left; no front end can show that yet`);
    return stop();
  }
  const leaveOutPath = join(settingDir, "leave-out.json");
  const leaveOut = new Set(existsSync(leaveOutPath) ? readJson<string[]>(leaveOutPath) : []);
  const packWords = attempt("words", () => {
    const extraPath = join(langDir, "extra-words.json");
    const extra = existsSync(extraPath) ? readJson<PackWord[]>(extraPath).map((w) => ({ ...w, bonus: true })) : [];
    // bonus.json: pack words above the stage that the course may use anyway, e.g. 面条 at a noodle shop.
    const bonusPath = join(langDir, "bonus.json");
    const bonusIds = new Set(existsSync(bonusPath) ? readJson<string[]>(bonusPath) : []);
    const pack = readJson<PackWord[]>(join(langDir, "words.json")).map((w) => (bonusIds.has(w.id) ? { ...w, bonus: true } : w));
    for (const id of bonusIds) if (!pack.some((w) => w.id === id)) throw new Error(`bonus.json: unknown word id "${id}"`);
    // leave-out.json: pack words the setting has no place for, e.g. 电脑 in 1980. They stay in the
    // course so old saves still find them, but count toward no stage, and no line may use them.
    for (const id of leaveOut) if (!pack.some((w) => w.id === id)) throw new Error(`settings/${cfg.setting}/leave-out.json: unknown word id "${id}"`);
    return [...pack.map((w) => (leaveOut.has(w.id) ? { ...w, bonus: true } : w)), ...extra];
  });
  const lex: Lexicon | undefined = packWords && attempt("words", () => buildLexicon(packWords));
  if (!packWords || !lex) return stop();

  const toLine = (marked: string, where: string): RenderedLine => {
    const { text, tokens, unknown, problems } = segmentMarked(marked, lex);
    for (const p of problems) errors.push(`${where}: "${marked}": ${p}`);
    if (unknown.length) errors.push(`${where}: "${text}" has characters outside the word list: ${unknown.map((u) => u.char).join(" ")}`);
    for (const tk of tokens) if (leaveOut.has(tk.word)) errors.push(`${where}: "${text}" uses ${text.slice(tk.start, tk.end)}, which settings/${cfg.setting}/leave-out.json leaves out`);
    return { text, tokens };
  };

  const glossSrc: FtlSource[] = [`glosses-${cfg.language}.ftl`, `glosses-${cfg.language}-extra.ftl`].map((f) => [
    f,
    readOptional(join(learnerDir, f)),
  ]);
  const glosses = attempt("glosses", () => new Renderer(learner, glossSrc));
  // Hand-curated 1-3 word display glosses, for the words the heuristic in packages/view/src/help.ts
  // can't shorten well on its own (see content/learner/en/glosses-zh-short.ftl). Optional: a word
  // with no entry here just falls back to that heuristic, which the checker warns about below.
  const shortSrc: FtlSource = [`glosses-${cfg.language}-short.ftl`, readOptional(join(learnerDir, `glosses-${cfg.language}-short.ftl`))];
  const shorts = attempt("glosses-short", () => new Renderer(learner, [shortSrc]));
  const words: Record<string, WordExtra> = {};
  for (const w of packWords) {
    if (glosses && !glosses.has(w.id)) errors.push(`glosses: no ${learner} gloss for ${w.id} "${w.w}"`);
    const { attach } = w as { attach?: unknown };
    if (attach !== undefined && typeof attach !== "boolean") errors.push(`words: ${w.id} "${w.w}": attach must be true or false`);
    words[w.id] = {
      id: w.id,
      w: w.w,
      lv: w.lv,
      gloss: glosses?.has(w.id) ? glosses.render(w.id) : "",
      ...(shorts?.has(w.id) ? { short: shorts.render(w.id) } : {}),
      ...(w.readings ? { readings: w.readings } : w.pron ? { readings: [w.pron] } : {}),
      ...(w.forms ? { forms: w.forms } : {}),
      ...(w.bonus ? { bonus: true } : {}),
      // attach: a particle or ending the front ends show glued to the tile before it; its other
      // spellings come along so a tile spelled that way is found too
      ...(w.attach === true ? { attach: true, ...(w.alt?.length ? { alt: w.alt } : {}) } : {}),
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
  const meaningTermsName = `learner/${learner}/terms.ftl`;
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
  const newWordsOverride: Record<string, number> = {};
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
    const meaningsName = `learner/${learner}/lines-${cfg.language}/${sk.id}.ftl`;
    if (!existsSync(meaningsPath)) errors.push(`${sk.id}: no ${learner} meanings (${meaningsPath})`);
    const meaningsSrc =
      meaningTerms === undefined || !existsSync(meaningsPath)
        ? undefined
        : attempt(sk.id, () => {
            const src = readFileSync(meaningsPath, "utf8");
            parseFtl(src, meaningsName);
            return src;
          });
    for (const [name, src] of [[linesName, linesSrc], [meaningsName, meaningsSrc]] as const)
      if (src !== undefined) for (const id of duplicateIds(src, name)) errors.push(`${name}: "${id}" is defined more than once`);
    const exchanges: Exchange[] = [];
    for (const ex of sk.exchanges) {
      const variants: Record<string, Variant> = {};
      const altNumbers = new Set<string>(); // the Fluent alt numbers some variant has
      const unknownGroups = Object.values(ex.slots).filter((g) => !groups[g]);
      if (unknownGroups.length) {
        errors.push(`${sk.id}/${ex.id}: unknown group ${unknownGroups.map((g) => `"${g}"`).join(", ")}`);
        continue;
      }
      if (ex.cost !== undefined && typeof ex.cost !== "number") {
        const group = typeof ex.cost === "string" && ex.cost.startsWith("$") ? ex.slots[ex.cost.slice(1)] : undefined;
        if (!group || !groups[group].every((c) => c in numbers)) {
          errors.push(`${sk.id}/${ex.id}: cost ${JSON.stringify(ex.cost)} must be a number or a slot whose values are all numbers`);
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
          // A written wrong reply's own answer, and whether it gets the player through.
          const outcomes: NonNullable<Variant["altOutcomes"]> = {};
          altIds.forEach((id, i) => {
            altNumbers.add(id.slice(`${ex.id}-alt`.length));
            const out: AltOutcome = { ...ex.alts?.[id.slice(`${ex.id}-alt`.length)] };
            if (r.has(`${id}-answer`)) out.reaction = toLine(r.render(`${id}-answer`, args), where);
            if (Object.keys(out).length) outcomes[String(i)] = out;
          });
          if (Object.keys(outcomes).length) variant.altOutcomes = outcomes;
          variants[comboKey(combo)] = variant;
          if (typeof ex.cost === "number") variant.cost = ex.cost;
          else if (typeof ex.cost === "string" && ex.cost.startsWith("$") && combo[ex.cost.slice(1)] in numbers) {
            variant.cost = numbers[combo[ex.cost.slice(1)]];
          }
          if (meaningsSrc === undefined || meaningTerms === undefined) return;
          attempt(`${where} (${learner} meaning)`, () => {
            const m = new Renderer(learner, [
              [meaningTermsName, meaningTerms],
              ["slots", bindSlots(meaningTerms, combo, meaningsSrc, meaningsName, meaningTermsName)],
              [meaningsName, meaningsSrc],
            ]);
            variant.npc.meaning = m.render(ex.id, args);
            variant.reply.meaning = m.render(`${ex.id}-reply`, args);
            if (variant.rephrase) variant.rephrase.meaning = m.render(`${ex.id}-rephrase`, args);
            variant.alts?.forEach((l, i) => (l.meaning = m.render(altIds[i], args)));
            for (const [i, out] of Object.entries(variant.altOutcomes ?? {})) {
              if (out.reaction) out.reaction.meaning = m.render(`${altIds[Number(i)]}-answer`, args);
            }
            // What a reply does ("Ask the price"), shown with it in place of its meaning.
            const intent = (id: string, l: RenderedLine) => {
              if (m.has(`${id}-intent`)) l.intent = m.render(`${id}-intent`, args);
            };
            intent(`${ex.id}-reply`, variant.reply);
            variant.alts?.forEach((l, i) => intent(altIds[i], l));
          });
        });
      }
      // The course carries each variant's resolved cost, never the skeleton's "$slot".
      for (const n of Object.keys(ex.alts ?? {})) {
        const o = ex.alts![n];
        const bad = (x: unknown) => x !== undefined && !(Number.isInteger(x) && (x as number) >= 0);
        if (!/^[123]$/.test(n)) errors.push(`${sk.id}/${ex.id}: alts "${n}" must be 1, 2 or 3 (the Fluent alt number)`);
        else if (!altNumbers.has(n))
          errors.push(`${sk.id}/${ex.id}: alts "${n}" has no ${ex.id}-alt${n} line`);
        if (!o.accept && (o.pay !== undefined || o.loss !== undefined)) errors.push(`${sk.id}/${ex.id}: alts "${n}": pay and loss need accept`);
        if (bad(o.pay) || bad(o.loss)) errors.push(`${sk.id}/${ex.id}: alts "${n}": pay and loss must be whole numbers, 0 or more`);
      }
      const { cost: _cost, alts: _alts, ...rest } = ex;
      exchanges.push({ ...rest, variants });
    }
    // "newWords" is a checker-only override: the course never carries it.
    const { newWords, ...sceneRest } = sk;
    if (newWords !== undefined) {
      if (!Number.isInteger(newWords) || newWords <= 0) errors.push(`${sk.id}: "newWords" must be a positive integer, got ${JSON.stringify(newWords)}`);
      else newWordsOverride[sk.id] = newWords;
    }
    scenes.push({ ...sceneRest, exchanges });
  }

  const reactions: Record<string, RenderedLine> = {};
  attempt("reactions.ftl", () => {
    const src = readFileSync(join(langDir, "reactions.ftl"), "utf8");
    const r = new Renderer(meta.locale, [["terms.ftl", termsSrc], ["reactions.ftl", src]]);
    const meaningsName = `learner/${learner}/reactions-${cfg.language}.ftl`;
    const m = attempt(meaningsName, () => new Renderer(learner, [[meaningsName, readFileSync(join(learnerDir, `reactions-${cfg.language}.ftl`), "utf8")]]));
    for (const id of messageIds(src, "reactions.ftl")) {
      const text = attempt(`reaction ${id}`, () => r.render(id));
      if (text === undefined) continue;
      reactions[id] = toLine(text, `reaction ${id}`);
      if (m) attempt(`reaction ${id} (${learner} meaning)`, () => (reactions[id].meaning = m.render(id)));
    }
  });

  // Concept names for narration: each concept's base form in the learner's language.
  const conceptNames: Record<string, string> = {};
  if (meaningTerms !== undefined) {
    for (const name of Object.keys(concepts)) {
      const r = attempt(`${meaningTermsName} -${name}`, () =>
        new Renderer(learner, [[meaningTermsName, meaningTerms], ["name", `name = { -${name} }`]]),
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
  // A stage word with no curated short gloss and a heuristic that fell back to shortening its
  // gloss's own parenthetical aside is usually a sign the pack's first sense isn't the everyday
  // one; flagged so glosses-<lang>-short.ftl can be filled in as new stages are added, without
  // failing the build over content that (unlike a missing gloss) still displays something.
  for (const ids of Object.values(stageWords)) {
    for (const id of ids) {
      const w = words[id];
      if (w?.gloss && !w.short && heuristicGloss(w.gloss).fellBack) {
        warnings.push(`glosses-${cfg.language}-short.ftl: no curated short gloss for ${id} "${w.w}" (${w.gloss}); heuristic fell back to its aside`);
      }
    }
  }
  const notesPath = join(langDir, "notes.json");
  const notes = (existsSync(notesPath) && attempt("notes.json", () => readJson<Note[]>(notesPath))) || [];

  const learnerFtl =
    attempt(`learner/${learner}`, () =>
      [
        readFileSync(join(learnerDir, "ui.ftl"), "utf8"),
        readFileSync(join(learnerDir, `narration-${cfg.setting}.ftl`), "utf8"),
        readOptional(join(learnerDir, `mentor-${cfg.language}.ftl`)),
        readOptional(join(learnerDir, `letters-${cfg.language}.ftl`)),
      ].join("\n"),
    ) ?? "";

  // ui, narration, mentor and letters are read as one: a key in two of them clashes too.
  if (learnerFtl) for (const id of duplicateIds(learnerFtl, `learner/${learner}`)) errors.push(`learner/${learner}: "${id}" is defined more than once (ui, narration-${cfg.setting}, mentor-${cfg.language} and letters-${cfg.language}.ftl are read as one)`);
  for (const [name, src] of [...glossSrc, shortSrc]) for (const id of duplicateIds(src, name)) errors.push(`learner/${learner}/${name}: "${id}" is defined more than once`);
  if (meta.tileGap !== undefined && typeof meta.tileGap !== "string") errors.push(`pack.json: "tileGap" must be text, got ${JSON.stringify(meta.tileGap)}`);
  if (meta.book !== undefined && typeof meta.book !== "boolean") errors.push(`pack.json: "book" must be true or false, got ${JSON.stringify(meta.book)}`);
  const liaisonOk = (l: unknown) =>
    !!l && typeof l === "object" && typeof (l as { before?: unknown }).before === "string" && Object.values((l as { finals?: object }).finals ?? { x: 0 }).every((v) => typeof v === "string");
  if (meta.liaison !== undefined && !liaisonOk(meta.liaison)) errors.push(`pack.json: "liaison" must be { "before": text, "finals": { text: text } }, got ${JSON.stringify(meta.liaison)}`);
  const course: CourseExtra = {
    id: cfg.id,
    learner,
    ...(cfg.aliases?.length ? { aliases: cfg.aliases } : {}),
    language: { code: meta.key, locale: meta.locale, tts: meta.tts, spaced: meta.spaced, ...(typeof meta.tileGap === "string" && meta.tileGap ? { tileGap: meta.tileGap } : {}), ...(meta.book === true ? { book: true } : {}), ...(meta.liaison && liaisonOk(meta.liaison) ? { liaison: meta.liaison } : {}) },
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
  // letters.json: the script's letter chart for the Book, each letter with its clip.
  const lettersPath = join(langDir, "letters.json");
  const letters = existsSync(lettersPath) ? attempt("letters.json", () => readJson<unknown>(lettersPath)) : undefined;
  if (letters !== undefined) {
    const problems = letterProblems(letters);
    errors.push(...problems);
    if (!problems.length) course.letters = letters as LetterChart;
  }
  // papers.json: the papers on the desk when a book course's story opens, each line with its clip.
  const papersPath = join(settingDir, "papers.json");
  const papers = existsSync(papersPath) ? attempt("papers.json", () => readJson<{ papers: DeskPaper[] }>(papersPath)) : undefined;
  if (papers !== undefined) {
    const problems = paperProblems(papers, Object.keys(world.places)).map((e) => `settings/${cfg.setting}/${e}`);
    errors.push(...problems);
    if (!problems.length) course.papers = papers.papers;
  }
  // Clips: every line in its speaker's voice, each word the course uses, each letter and each paper line.
  const voicesPath = join(langDir, "voices.json");
  const voices = existsSync(voicesPath) ? attempt("voices.json", () => readJson<Voices>(voicesPath)) : undefined;
  if (!existsSync(voicesPath) && cfg.checks.audio) errors.push("voices.json: missing (checks.audio is on)");
  if (voices) errors.push(...voiceProblems(voices, world, scenes));
  const used = usedWords(course);
  const says = Object.fromEntries(packWords.flatMap((w) => (w.say ? [[w.id, w.say]] : [])));
  const clips = voices ? assignAudio(course, voices, used, says) : [];
  if (voices && course.letters) {
    const have = new Set(clips.map((c) => c.id));
    clips.push(...assignLetterAudio(course.letters, voices).filter((c) => !have.has(c.id) && have.add(c.id)));
    clips.sort((a, b) => a.id.localeCompare(b.id));
  }
  if (voices && course.papers) {
    const have = new Set(clips.map((c) => c.id));
    clips.push(...assignPaperAudio(course.papers, voices).filter((c) => !have.has(c.id) && have.add(c.id)));
    clips.sort((a, b) => a.id.localeCompare(b.id));
  }
  const audioDir = join(root, "audio", cfg.language);
  const audioFiles = new Set(
    existsSync(audioDir) ? readdirSync(audioDir).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -".mp3".length)) : [],
  );
  const learnerIds = attempt("learner text", () => new Set(messageIds(learnerFtl, "learner files"))) ?? new Set<string>();
  for (const id of ["learner-name", `language-${cfg.language}`, ...(course.letters ? letterMessageIds(course.letters) : []), ...(course.papers ? paperMessageIds(course.papers) : [])]) {
    if (!learnerIds.has(id)) errors.push(`learner/${learner}/${id.startsWith("letters-guide-") ? `letters-${cfg.language}` : "ui"}.ftl: missing "${id}"`);
  }
  errors.push(...checkCourse({ course, stages: meta.stages, checks: cfg.checks, learnerIds, requiredUi: [], audioFiles, newWordsOverride }));
  errors.push(...uiTextProblems(learnerFtl, learner));
  // Each action's narration gets the parameters its exchanges' `expect` gives it, plus the current
  // scene's NPC (npc), which the front ends always supply alongside the action's own arguments.
  const actions: Record<string, string[]> = {};
  for (const ex of scenes.flatMap((s) => s.exchanges)) {
    const name = ex.expect.action;
    if (name) actions[name] = [...new Set([...(actions[name] ?? []), ...Object.keys(ex.expect).filter((k) => k !== "action"), "npc"])];
  }
  errors.push(...narrationProblems(learnerFtl, learner, actions));
  if (cfg.checks.art) errors.push(...artProblems(settingDir, world).map((e) => `settings/${cfg.setting}/${e}`));
  // only checked art ships: the page inlines these drawings
  const artDir = cfg.checks.art && existsSync(join(settingDir, "art")) ? settingDir : undefined;
  // Ship only the words the course uses: rank is the share of these that are known, and
  // the pack has far more words than one course needs. (The checks above see the whole pack.)
  course.words = Object.fromEntries(Object.entries(words).filter(([id]) => used.has(id)));
  return { course, errors, warnings, clips, audioDir, artDir };
}

const NO_LEARNERS = "learners must list at least one reading language";
const hasLearners = (cfg: CourseConfig) =>
  Array.isArray(cfg.learners) && cfg.learners.length > 0 && cfg.learners.every((l) => typeof l === "string" && l !== "");

/** Course ids: the config files in content/courses. */
export function courseIds(root: string): string[] {
  return readdirSync(join(root, "courses"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

export interface BuiltCourses {
  catalog: CatalogEntry[];
  builds: { course: string; learner: string; result: BuildResult }[];
  /** every build's errors, each prefixed "<course>/<learner>: " */
  errors: string[];
  /** every build's warnings, each prefixed "<course>/<learner>: "; never fails the build */
  warnings: string[];
}

/** Builds every course (or only `only`) for each of its reading languages. */
export function buildAll(root: string, only?: string): BuiltCourses {
  const out: BuiltCourses = { catalog: [], builds: [], errors: [], warnings: [] };
  for (const id of only ? [only] : courseIds(root)) {
    let cfg: CourseConfig;
    try {
      cfg = readJson<CourseConfig>(join(root, "courses", `${id}.json`));
    } catch (e) {
      out.errors.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    if (!hasLearners(cfg)) {
      out.errors.push(`${id}: courses/${id}.json: ${NO_LEARNERS}`);
      continue;
    }
    const learnerNames: Record<string, string> = {};
    for (const learner of cfg.learners) {
      const result = buildCourse(root, id, learner);
      out.builds.push({ course: id, learner, result });
      out.errors.push(...result.errors.map((e) => `${id}/${learner}: ${e}`));
      out.warnings.push(...result.warnings.map((e) => `${id}/${learner}: ${e}`));
      const name = result.course && learnerName(result.course.learnerFtl, learner);
      if (name) learnerNames[learner] = name;
    }
    // The learning simulator's limits (tools/src/learning.ts), on the first reading language only:
    // the words and scenes are the same in every one. Warnings until both courses meet them.
    const first = out.builds.find((b) => b.course === id && b.result.course);
    if (first) out.warnings.push(...learningCheck(root, first.result.course!).map((w) => `${id}: learning: ${w}`));
    out.catalog.push({ id: cfg.id, language: cfg.language, setting: cfg.setting, learners: cfg.learners, learnerNames });
  }
  // The settings screen names every course in the catalog, in whichever language the game is read in.
  const texts = out.builds.flatMap((b) => (b.result.course ? [{ course: b.course, learner: b.learner, ftl: b.result.course.learnerFtl }] : []));
  out.errors.push(...languageNameProblems(out.catalog, texts));
  return out;
}

/** Each reading language's text must name the language of every course in the catalog (`language-<code>`). */
export function languageNameProblems(catalog: CatalogEntry[], texts: { course: string; learner: string; ftl: string }[]): string[] {
  const problems: string[] = [];
  for (const { course, learner, ftl } of texts) {
    const ids = new Set(messageIds(ftl, "learner files"));
    for (const entry of catalog) {
      if (entry.id !== course && !ids.has(`language-${entry.language}`))
        problems.push(`${course}/${learner}: learner/${learner}/ui.ftl: missing "language-${entry.language}" (${entry.id} is in the catalog)`);
    }
  }
  return problems;
}

/** A reading language's own name, from its learner-name message. */
function learnerName(ftl: string, locale: string): string | undefined {
  try {
    return new Renderer(locale, [["learner", ftl]]).render("learner-name");
  } catch {
    return undefined;
  }
}

function main(): void {
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { catalog, builds, errors, warnings } = buildAll(join(repo, "content"), only);
  for (const w of warnings) console.warn(`! ${w}`);
  if (errors.length || builds.some((b) => !b.result.course)) {
    for (const e of errors) console.error(`✗ ${e}`);
    console.error(`${errors.length} error(s); nothing written`);
    process.exit(1);
  }
  writeCourses(join(repo, "dist", "courses"), builds, catalog, only);
  // --update-tagging: rewrite each built language's snapshot of how its lines split into words
  if (process.argv.includes("--update-tagging")) {
    for (const { result } of builds) {
      const c = result.course!;
      writeFileSync(taggingPath(join(repo, "content"), c.language.code), taggingLines(c).join("\n") + "\n");
      console.log(`tagging: languages/${c.language.code}/tagging.txt`);
    }
  }
}

/**
 * Writes the built files and the catalog. A full build replaces the folder and a one-course build
 * that course's folder, so a renamed course or a dropped reading language leaves nothing behind.
 */
export function writeCourses(out: string, builds: BuiltCourses["builds"], catalog: CatalogEntry[], only?: string): void {
  rmSync(only ? join(out, only) : out, { recursive: true, force: true });
  for (const { course, learner, result } of builds) {
    mkdirSync(join(out, course), { recursive: true });
    writeFileSync(join(out, course, `${learner}.json`), JSON.stringify(result.course));
    if (result.artDir) {
      cpSync(join(result.artDir, "art"), join(out, course, "art"), { recursive: true });
      cpSync(join(result.artDir, "art.json"), join(out, course, "art", "art.json"));
    }
    console.log(`built ${course}/${learner}: ${result.course!.scenes.length} scenes`);
  }
  const index = join(out, "index.json");
  const previous: CatalogEntry[] = only && existsSync(index) ? (JSON.parse(readFileSync(index, "utf8")) as CatalogEntry[]) : [];
  const merged = [...previous.filter((e) => !catalog.some((c) => c.id === e.id)), ...catalog].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(index, JSON.stringify(merged, null, 2));
  console.log(`catalog: ${merged.map((e) => e.id).join(", ")} -> ${index}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
