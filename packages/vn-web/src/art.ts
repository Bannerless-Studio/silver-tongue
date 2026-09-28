/** Per place: the silhouettes' tint and rim light, and where each NPC stands (0-1 across). */
export interface PlaceArt {
  tint: string;
  rim: string;
  spots: Record<string, number>;
}
export interface Art {
  place(id: string, name: string): { svg: string } & PlaceArt;
  npc(id: string): string;
  /** where an NPC stands at a place, 0-1 across; evenly spread among `others` when art.json doesn't say */
  spot(place: string, npc: string, others: string[]): number;
}
/** Fetches a text file; null when it isn't there. */
export type GetText = (url: string) => Promise<string | null>;

const DEFAULT: PlaceArt = { tint: "#16181f", rim: "#e8dcc0", spots: {} };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A plain backdrop with the place's name, for a course that has no drawing of it. */
export function fallbackPlace(name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4557"/><stop offset="1" stop-color="#1c2029"/></linearGradient></defs><rect width="1600" height="900" fill="url(#fb)"/><text x="800" y="200" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" fill="#ffffff55">${escape(name)}</text></svg>`;
}

/** Someone, for a course that has no drawing of them. */
export const FALLBACK_NPC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 900"><path fill="currentColor" d="M200 60a70 70 0 1 1 0 140a70 70 0 1 1 0-140zM120 230h160l50 670H70z"/></svg>`;

/** The courses the visual novel can show: those with art (`<base><id>/art/art.json`); a text-only course is left out. */
export async function withArt<E extends { id: string }>(catalog: E[], base: string, get: GetText): Promise<E[]> {
  const has = await Promise.all(catalog.map(async (e) => (await get(`${base}${e.id}/art/art.json`)) !== null));
  return catalog.filter((_, i) => has[i]);
}

/** Fetches a course's art (under `<base>art/`) up front; anything missing falls back. */
export async function loadArt(base: string, course: { world: { places: Record<string, unknown>; npcs: Record<string, unknown> } }, get: GetText): Promise<Art> {
  const safe = async (url: string) => {
    try {
      return await get(url);
    } catch {
      return null;
    }
  };
  let places: Record<string, PlaceArt> = {};
  try {
    places = (JSON.parse((await safe(`${base}art/art.json`)) ?? "{}") as { places?: Record<string, PlaceArt> }).places ?? {};
  } catch {
    // unreadable art.json: defaults everywhere
  }
  const [placeSvgs, npcSvgs] = await Promise.all(
    (["places", "npcs"] as const).map(async (kind) => {
      const ids = Object.keys(course.world[kind]);
      const svgs = await Promise.all(ids.map((id) => safe(`${base}art/${kind}/${id}.svg`)));
      return Object.fromEntries(ids.map((id, i) => [id, svgs[i]]));
    }),
  );
  return {
    place: (id, name) => ({ ...DEFAULT, ...places[id], svg: placeSvgs[id] ?? fallbackPlace(name) }),
    npc: (id) => npcSvgs[id] ?? FALLBACK_NPC,
    spot: (place, npc, others) => places[place]?.spots?.[npc] ?? (others.indexOf(npc) + 1) / (others.length + 1),
  };
}
