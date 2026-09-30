import type { DeskPaper } from "@silver-tongue/view";
import { lineClips, type Clip, type Voices } from "./voices";

/** Ids end up in storage and clip lookups, so they stay simple. */
const NAME = /^[A-Za-z0-9_-]+$/;
const KINDS = new Set(["card", "masthead", "bill"]);
const PAPER_KEYS = new Set(["id", "kind", "names", "lines"]);
const LINE_KEYS = new Set(["id", "text", "say"]);
/** What a paper may say: Hangul syllables, digits, spaces and punctuation. No English, ever. */
const PAPER_TEXT = /^[가-힣0-9\s.,:\-/()·~]+$/u;
const HANGUL_TEXT = /^[가-힣\s]+$/u;

/** Problems with content/settings/<setting>/papers.json, each naming where it is. `places`: the world's place ids. */
export function paperProblems(json: unknown, places: string[]): string[] {
  const errors: string[] = [];
  const papers = (json as { papers?: unknown } | null)?.papers;
  if (!Array.isArray(papers) || papers.length === 0) return ['papers.json: "papers" must be a non-empty list'];
  const ids = new Set<string>();
  papers.forEach((p: Record<string, unknown>, i) => {
    const id = typeof p?.id === "string" ? p.id : "";
    const where = `papers.json: paper ${id ? `"${id}"` : i + 1}`;
    if (!NAME.test(id)) errors.push(`${where}: id must be letters, digits, _ and -`);
    else if (ids.has(id)) errors.push(`${where}: id is used twice`);
    ids.add(id);
    for (const k of Object.keys(p ?? {})) if (!PAPER_KEYS.has(k)) errors.push(`${where}: unknown field "${k}"`);
    if (typeof p?.kind !== "string" || !KINDS.has(p.kind)) errors.push(`${where}: kind must be one of ${[...KINDS].join(", ")}`);
    if (p?.names !== undefined && (typeof p.names !== "string" || !places.includes(p.names))) errors.push(`${where}: names "${String(p.names)}" is not a place`);
    if (!Array.isArray(p?.lines) || p.lines.length === 0) {
      errors.push(`${where}: "lines" must be a non-empty list`);
      return;
    }
    const lineIds = new Set<string>();
    for (const l of p.lines as Record<string, unknown>[]) {
      const lid = typeof l?.id === "string" ? l.id : "";
      if (!NAME.test(lid)) errors.push(`${where}: a line id must be letters, digits, _ and -`);
      else if (lineIds.has(lid)) errors.push(`${where}: line "${lid}" is used twice`);
      lineIds.add(lid);
      for (const k of Object.keys(l ?? {})) if (!LINE_KEYS.has(k)) errors.push(`${where}: line "${lid}" has an unknown field "${k}"`);
      if (typeof l?.text !== "string" || !l.text.trim()) errors.push(`${where}: line "${lid}" has no text`);
      else if (!PAPER_TEXT.test(l.text)) errors.push(`${where}: line "${lid}" may only use Hangul, digits and punctuation`);
      if (l?.say !== undefined && (typeof l.say !== "string" || !HANGUL_TEXT.test(l.say))) errors.push(`${where}: line "${lid}" say must be Hangul`);
    }
  });
  return errors;
}

/** Messages the desk needs: the line after the last paper, and each named place's new name. */
export const paperMessageIds = (papers: DeskPaper[]): string[] => [
  "desk-done",
  ...[...new Set(papers.flatMap((p) => (p.names ? [`place-${p.names}-known`] : [])))],
];

/** Gives each paper line its clip ids in the words voice (saying `say`, else the text). Returns the clips. */
export function assignPaperAudio(papers: DeskPaper[], voices: Voices): Clip[] {
  const clips: Clip[] = [];
  for (const l of papers.flatMap((p) => p.lines)) {
    const cs = lineClips(l.say ?? l.text, voices.words);
    l.audio = cs.map((c) => c.id);
    clips.push(...cs);
  }
  return clips;
}
