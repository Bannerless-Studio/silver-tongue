import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { World } from "@silver-tongue/core";

/** A setting's drawings: places are 16:9 backdrops, NPCs faceless silhouettes in currentColor. */
export const PLACE_VIEWBOX = "0 0 1600 900";
export const NPC_VIEWBOX = "0 0 400 900";
export const MAX_ART_BYTES = 40 * 1024;

/** Per place: the silhouettes' tint and rim light for its light, and where each NPC stands (0-1 across). */
export interface PlaceArt {
  tint: string;
  rim: string;
  spots: Record<string, number>;
}
export interface ArtJson {
  places: Record<string, PlaceArt>;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** What makes an SVG unsafe or unfit to inline in the page. Ids start with `prefix-` so drawings inlined together never clash. */
export function svgProblems(name: string, svg: string, viewBox: string, prefix?: string): string[] {
  const out: string[] = [];
  const bytes = Buffer.byteLength(svg);
  if (bytes > MAX_ART_BYTES) out.push(`${name}: ${Math.ceil(bytes / 1024)} KB, over 40 KB`);
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  if (/\bviewBox="([^"]*)"/.exec(root)?.[1] !== viewBox) out.push(`${name}: viewBox must be "${viewBox}"`);
  if (/<script\b/i.test(svg)) out.push(`${name}: no <script>`);
  const on = /\s(on[a-z]+)\s*=/i.exec(svg);
  if (on) out.push(`${name}: no event attributes (${on[1]})`);
  if (/\b(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) out.push(`${name}: no links outside the file`);
  if (/<(image|foreignObject)\b/i.test(svg)) out.push(`${name}: no <image> or <foreignObject>`);
  if (prefix) for (const [, id] of svg.matchAll(/\sid="([^"]*)"/g)) if (!id.startsWith(`${prefix}-`)) out.push(`${name}: id "${id}" must start with "${prefix}-"`);
  return out;
}

/** Every problem with a setting's art: missing or unfit drawings, and art.json entries. */
export function artProblems(settingDir: string, world: World): string[] {
  const out: string[] = [];
  let json: ArtJson | undefined;
  try {
    json = JSON.parse(readFileSync(join(settingDir, "art.json"), "utf8")) as ArtJson;
  } catch (e) {
    out.push(`art.json: ${(e as Error).message}`);
  }
  const check = (kind: "places" | "npcs", ids: string[], viewBox: string) => {
    for (const id of ids) {
      const rel = `art/${kind}/${id}.svg`;
      const path = join(settingDir, rel);
      if (!existsSync(path)) out.push(`${rel}: missing`);
      else out.push(...svgProblems(rel, readFileSync(path, "utf8"), viewBox, id));
    }
    const dir = join(settingDir, "art", kind);
    const extra = existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir).filter((f) => f.endsWith(".svg") && !ids.includes(f.slice(0, -4))) : [];
    for (const f of extra) out.push(`art/${kind}/${f}: no such ${kind === "places" ? "place" : "NPC"}`);
  };
  check("places", Object.keys(world.places), PLACE_VIEWBOX);
  check("npcs", Object.keys(world.npcs), NPC_VIEWBOX);
  if (!json) return out;
  for (const place of Object.keys(world.places)) {
    const p = json.places?.[place];
    if (!p) {
      out.push(`art.json: no entry for place ${place}`);
      continue;
    }
    for (const key of ["tint", "rim"] as const) if (!HEX.test(p[key] ?? "")) out.push(`art.json: ${place} ${key} "${p[key]}" must be a hex colour`);
    for (const [npc, at] of Object.entries(world.npcs)) {
      if (at.place !== place) continue;
      const x = p.spots?.[npc];
      if (typeof x !== "number" || x < 0 || x > 1) out.push(`art.json: ${place} has no spot for ${npc} (a number from 0 to 1)`);
    }
  }
  return out;
}
