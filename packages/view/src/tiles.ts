import { joinTiles, type Course, type WordId } from "@silver-tongue/core";
import { extra } from "./course-extra";

/** Per words table: each spelling (w, alt, form) -> whether every word spelled that way attaches. */
const attachCache = new WeakMap<object, Map<string, boolean>>();

function attachBySpelling(course: Course): Map<string, boolean> {
  const words = extra(course).words;
  const cached = attachCache.get(words);
  if (cached) return cached;
  const map = new Map<string, boolean>();
  for (const w of Object.values(words)) {
    for (const s of new Set([w.w, ...(w.alt ?? []), ...Object.keys(w.forms ?? {})])) map.set(s, (map.get(s) ?? true) && w.attach === true);
  }
  attachCache.set(words, map);
  return map;
}

/**
 * Reply tiles as they are shown (display only: grading joins them with core's `joinTiles`). A spaced
 * language joins them with spaces, as core does. Otherwise tiles are joined with the language's
 * `tileGap` ("" unless it sets one), except before a tile whose word attaches to the one before it
 * (a particle or an ending). A tile is matched to its word by spelling; a spelling several words
 * share attaches only if all of them do, unless `ids` names the tile's word.
 */
export function joinTilesForDisplay(course: Course, tiles: string[], ids?: (WordId | undefined)[]): string {
  const c = extra(course);
  if (c.language.spaced) return joinTiles(course, tiles);
  const gap = c.language.tileGap ?? "";
  const bySpelling = attachBySpelling(course);
  const attaches = (i: number): boolean => {
    const id = ids?.[i];
    if (id !== undefined && c.words[id]) return c.words[id].attach === true;
    return bySpelling.get(tiles[i]) === true;
  };
  return tiles.reduce((out, tile, i) => (i === 0 ? tile : out + (attaches(i) ? "" : gap) + tile), "");
}
