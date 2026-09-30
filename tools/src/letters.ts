import type { LetterChart } from "@silver-tongue/view";
import { lineClips, type Clip, type Voices } from "./voices";

/** Group ids end up in message ids (letters-group-<id>), so they stay simple. */
const NAME = /^[A-Za-z0-9_-]+$/;
const OPTIONAL_TEXT = ["name", "reading", "say"] as const;
/** Every field a letter may have; `audio` is added by the build, never written by hand. */
const LETTER_KEYS = new Set<string>(["ch", ...OPTIONAL_TEXT]);

/** Problems with content/languages/<lang>/letters.json, each naming where it is. */
export function letterProblems(chart: unknown): string[] {
  const errors: string[] = [];
  errors.push(...guideProblems((chart as { guide?: unknown } | null)?.guide));
  const groups = (chart as { groups?: unknown } | null)?.groups;
  if (!Array.isArray(groups) || groups.length === 0) return ["letters.json: \"groups\" must be a non-empty list"];
  const ids = new Set<string>();
  groups.forEach((g: { id?: unknown; letters?: unknown }, i) => {
    const id = typeof g?.id === "string" ? g.id : "";
    const where = `letters.json: group ${id ? `"${id}"` : i + 1}`;
    if (!NAME.test(id)) errors.push(`${where}: id must be letters, digits, _ and -`);
    else if (ids.has(id)) errors.push(`${where}: id is used twice`);
    ids.add(id);
    if (!Array.isArray(g?.letters) || g.letters.length === 0) {
      errors.push(`${where}: "letters" must be a non-empty list`);
      return;
    }
    const seen = new Set<string>();
    for (const l of g.letters as Record<string, unknown>[]) {
      if (typeof l?.ch !== "string" || l.ch === "") {
        errors.push(`${where}: a letter has no "ch"`);
        continue;
      }
      if (seen.has(l.ch)) errors.push(`${where}: "${l.ch}" is listed twice`);
      seen.add(l.ch);
      for (const k of Object.keys(l)) if (!LETTER_KEYS.has(k)) errors.push(`${where}: "${l.ch}" has an unknown field "${k}"`);
      for (const k of OPTIONAL_TEXT) {
        if (l[k] !== undefined && (typeof l[k] !== "string" || l[k] === "")) errors.push(`${where}: "${l.ch}" ${k} must be text`);
      }
    }
  });
  return errors;
}

/** An example is written in the script: at least one letter of it, and digits (a year, a number) are fine too. */
const EXAMPLE = /^(?=.*\p{Script=Hangul})[\p{Script=Hangul}\p{Nd}]+$/u;
const GUIDE_KEYS = new Set(["id", "examples"]);

/** Problems with the "how to read" guide in letters.json (optional): each step has an id and Hangul examples. */
function guideProblems(guide: unknown): string[] {
  if (guide === undefined) return [];
  if (!Array.isArray(guide) || guide.length === 0) return ['letters.json: "guide" must be a non-empty list'];
  const errors: string[] = [];
  const ids = new Set<string>();
  guide.forEach((s: Record<string, unknown>, i) => {
    const id = typeof s?.id === "string" ? s.id : "";
    const where = `letters.json: guide step ${id ? `"${id}"` : i + 1}`;
    if (!NAME.test(id)) errors.push(`${where}: id must be letters, digits, _ and -`);
    else if (ids.has(id)) errors.push(`${where}: id is used twice`);
    ids.add(id);
    for (const k of Object.keys(s ?? {})) if (!GUIDE_KEYS.has(k)) errors.push(`${where}: unknown field "${k}"`);
    const ex = s?.examples;
    if (ex === undefined) return;
    if (!Array.isArray(ex) || ex.length === 0) return void errors.push(`${where}: "examples" must be a non-empty list`);
    for (const e of ex) if (typeof e !== "string" || !EXAMPLE.test(e)) errors.push(`${where}: example ${JSON.stringify(e)} must be Hangul (digits allowed)`);
  });
  return errors;
}

/** The message ids a learner language needs for the chart: each group's name and each guide step's text. */
export const letterMessageIds = (chart: LetterChart): string[] => [
  ...chart.groups.map((g) => `letters-group-${g.id}`),
  ...(chart.guide ?? []).map((s) => `letters-guide-${s.id}`),
];

/** Gives each letter its clip ids in the words voice (saying `say`, else `name`, else the letter). Returns the clips. */
export function assignLetterAudio(chart: LetterChart, voices: Voices): Clip[] {
  const clips: Clip[] = [];
  for (const l of chart.groups.flatMap((g) => g.letters)) {
    const cs = lineClips(l.say ?? l.name ?? l.ch, voices.words);
    l.audio = cs.map((c) => c.id);
    clips.push(...cs);
  }
  // The guide's examples are tappable too: each gets its clip, in the same voice.
  for (const step of chart.guide ?? []) {
    step.audio = (step.examples ?? []).map((e) => {
      const cs = lineClips(e, voices.words);
      clips.push(...cs);
      return cs.map((c) => c.id);
    });
  }
  return clips;
}
