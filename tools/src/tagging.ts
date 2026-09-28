import { join } from "node:path";
import { PLAYER_MARK, type Course, type RenderedLine } from "@silver-tongue/core";

/** content/languages/<language>/tagging.txt: every line's split, committed so a wrong split shows in review. */
export const taggingPath = (root: string, language: string) => join(root, "languages", language, "tagging.txt");

/** A line as its pieces: each word, each run of text between words, and the player's name as {name}, joined by "|". */
function split(l: RenderedLine): string {
  const pieces: string[] = [];
  const gap = (s: string) =>
    s.split(PLAYER_MARK).forEach((part, i) => {
      if (i) pieces.push("{name}");
      if (part.trim()) pieces.push(part.trim());
    });
  let at = 0;
  for (const tk of l.tokens) {
    gap(l.text.slice(at, tk.start));
    pieces.push(l.text.slice(tk.start, tk.end));
    at = tk.end;
  }
  gap(l.text.slice(at));
  return pieces.join("|");
}

/** One entry per line in the course, `<scene>/<exchange>[<combo>]/<role>: <split>`, sorted, each once. */
export function taggingLines(course: Course): string[] {
  const out = new Set<string>();
  for (const s of course.scenes)
    for (const ex of s.exchanges)
      for (const [key, v] of Object.entries(ex.variants)) {
        const at = `${s.id}/${ex.id}${key ? `[${key}]` : ""}`;
        const roles: [string, RenderedLine | undefined][] = [["npc", v.npc], ["reply", v.reply], ["rephrase", v.rephrase]];
        v.alts?.forEach((a, i) => roles.push([`alt${i + 1}`, a]));
        for (const [role, l] of roles) if (l) out.add(`${at}/${role}: ${split(l)}`);
      }
  for (const [id, l] of Object.entries(course.reactions)) out.add(`reaction/${id}: ${split(l)}`);
  return [...out].sort();
}
