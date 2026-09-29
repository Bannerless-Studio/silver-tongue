import type { LetterChart } from "@silver-tongue/view";
import { lineClips, type Clip, type Voices } from "./voices";

/** Group ids end up in message ids (letters-group-<id>), so they stay simple. */
const NAME = /^[A-Za-z0-9_-]+$/;
const OPTIONAL_TEXT = ["name", "reading", "say"] as const;

/** Problems with content/languages/<lang>/letters.json, each naming where it is. */
export function letterProblems(chart: unknown): string[] {
  const errors: string[] = [];
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
      for (const k of OPTIONAL_TEXT) {
        if (l[k] !== undefined && (typeof l[k] !== "string" || l[k] === "")) errors.push(`${where}: "${l.ch}" ${k} must be text`);
      }
    }
  });
  return errors;
}

/** The message ids a learner language needs for the chart: each group's name. */
export const letterMessageIds = (chart: LetterChart): string[] => chart.groups.map((g) => `letters-group-${g.id}`);

/** Gives each letter its clip ids in the words voice (saying `say`, else `name`, else the letter). Returns the clips. */
export function assignLetterAudio(chart: LetterChart, voices: Voices): Clip[] {
  const clips: Clip[] = [];
  for (const l of chart.groups.flatMap((g) => g.letters)) {
    const cs = lineClips(l.say ?? l.name ?? l.ch, voices.words);
    l.audio = cs.map((c) => c.id);
    clips.push(...cs);
  }
  return clips;
}
