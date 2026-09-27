import type { CatalogEntry } from "@silver-tongue/core";
import type { SpeechSpeed } from "./audio";
import type { Text } from "./text";

/** What the player chose, kept apart from any course's saves. */
export interface PlayerSettings {
  /** the course being learned */
  course?: string;
  /** the reading language */
  learner?: string;
  /** how fast clips are said; unset means "slow" */
  speed?: SpeechSpeed;
}

const SPEECH_SPEEDS = new Set<SpeechSpeed>(["slow", "normal", "fast"]);

/** Settings from their stored text; anything unreadable is left unset, never an error. */
export function parseSettings(raw: string | null | undefined): PlayerSettings {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "null");
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const d = data as Record<string, unknown>;
  const out: PlayerSettings = {};
  if (typeof d.course === "string") out.course = d.course;
  if (typeof d.learner === "string") out.learner = d.learner;
  if (typeof d.speed === "string" && SPEECH_SPEEDS.has(d.speed as SpeechSpeed)) out.speed = d.speed as SpeechSpeed;
  return out;
}

export type Start = { ask: true } | { ask: false; course: CatalogEntry; learner: string } | { error: string };

/** The first of `wanted` the course can be read in, else its default. */
export function learnerFor(entry: CatalogEntry, ...wanted: (string | undefined)[]): string {
  return wanted.find((w) => w !== undefined && entry.learners.includes(w)) ?? entry.learners[0];
}

/** --learn, else the saved course, else the only course; otherwise the player is asked. */
export function chooseStart(catalog: CatalogEntry[], settings: PlayerSettings, flags: { learn?: string; read?: string } = {}): Start {
  let course: CatalogEntry | undefined;
  if (flags.learn !== undefined) {
    course = catalog.find((c) => c.id === flags.learn) ?? catalog.find((c) => c.language === flags.learn);
    if (!course) return { error: `no course for "${flags.learn}"` };
  } else {
    course = catalog.find((c) => c.id === settings.course) ?? (catalog.length === 1 ? catalog[0] : undefined);
  }
  if (!course) return { ask: true };
  return { ask: false, course, learner: learnerFor(course, flags.read, settings.learner) };
}

/** "1) Chinese", … : each course by the name of its language. */
export function courseLabels(catalog: CatalogEntry[], t: Text): string[] {
  return catalog.map((c, i) => `${i + 1}) ${t.has(`language-${c.language}`) ? t(`language-${c.language}`) : c.language}`);
}
