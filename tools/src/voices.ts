import { createHash } from "node:crypto";
import { PLAYER_MARK, type Course, type RenderedLine, type Scene, type WordId, type World } from "@silver-tongue/core";

/** content/languages/<lang>/voices.json: which text-to-speech voice says what. */
export interface Voices {
  engine: string;
  /** the player's replies; no NPC may use it */
  player: string;
  /** single words, in the notebook and word help */
  words: string;
  npcs: Record<string, string>;
}

/** One clip to make: its file is content/audio/<lang>/<id>.mp3. */
export interface Clip {
  id: string;
  voice: string;
  text: string;
}

export const clipId = (voice: string, text: string): string => createHash("sha1").update(`${voice}|${text}`).digest("hex").slice(0, 16);

/** A part with no letter or digit ("，", "。") has nothing to say. */
const speakable = (s: string) => /[\p{L}\p{N}]/u.test(s);

/** The clips that say a line: one each side of the player's name, skipping a side with nothing to say. */
export function lineClips(text: string, voice: string): Clip[] {
  return text
    .split(PLAYER_MARK)
    .filter(speakable)
    .map((part) => ({ id: clipId(voice, part), voice, text: part }));
}

/** Every NPC has a voice, none has the player's, and no two in one place sound the same. */
export function voiceProblems(voices: Voices, world: World, scenes: Scene[]): string[] {
  const problems: string[] = [];
  const ids = [...new Set([...Object.keys(world.npcs), ...scenes.map((s) => s.npc)])];
  for (const npc of ids) {
    const voice = voices.npcs[npc];
    if (!voice) problems.push(`voices: npc "${npc}" has no voice`);
    else if (voice === voices.player) problems.push(`voices: npc "${npc}" uses the player's voice`);
  }
  ids.forEach((a, i) => {
    for (const b of ids.slice(i + 1)) {
      const place = world.npcs[a]?.place;
      if (place && place === world.npcs[b]?.place && voices.npcs[a] && voices.npcs[a] === voices.npcs[b]) {
        problems.push(`voices: "${a}" and "${b}" are both at ${place} with voice ${voices.npcs[a]}`);
      }
    }
  });
  return problems;
}

/**
 * Gives every scene line, the given words and every reaction (once per NPC with a scene) its clip
 * ids. Returns each clip needed, once, sorted by id.
 */
export function assignAudio(course: Course, voices: Voices, words: Iterable<WordId>): Clip[] {
  const clips = new Map<string, Clip>();
  const say = (text: string, voice: string | undefined): string[] => {
    if (!voice) return [];
    const cs = lineClips(text, voice);
    for (const c of cs) clips.set(c.id, c);
    return cs.map((c) => c.id);
  };
  const set = (l: RenderedLine | undefined, voice: string | undefined) => {
    if (l) l.audio = say(l.text, voice);
  };
  for (const s of course.scenes) {
    const npc = voices.npcs[s.npc];
    for (const ex of s.exchanges) {
      for (const v of Object.values(ex.variants)) {
        set(v.npc, npc);
        set(v.rephrase, npc);
        set(v.reply, voices.player);
        v.alts?.forEach((a) => set(a, voices.player));
      }
    }
  }
  for (const id of words) {
    const w = course.words[id];
    if (w) w.audio = say(w.w, voices.words);
  }
  const speakers = [...new Set(course.scenes.map((s) => s.npc))].sort();
  course.reactionAudio = Object.fromEntries(
    Object.entries(course.reactions).map(([id, l]) => [id, Object.fromEntries(speakers.map((npc) => [npc, say(l.text, voices.npcs[npc])]))]),
  );
  return [...clips.values()].sort((a, b) => a.id.localeCompare(b.id));
}
