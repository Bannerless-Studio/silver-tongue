// The 3D game's own settings, apart from the shared `silver-tongue:settings` (course + reading
// language, which tui-web also reads and rewrites whole): sound on / off for music, ambience and
// effects (word clips follow core's setSound as well), the music volume, whether ambience plays
// its full set of beds or just the quiet default (ambienceFull), whether the first-steps guide
// (and wayfinding's "lost?" reminder) is hidden (and whether its note after the first bark was
// shown), and whether the ground path hint is off. Unreadable or blocked storage: the defaults.
import type { KeyValue } from "@silver-tongue/web-common";

export const PREFS_KEY = "silver-tongue:world3d:prefs";

/** the music volume this build shipped with before "quiet by default": a stored 0.8 with no musicSet is never a real choice */
export const OLD_DEFAULT_MUSIC = 0.8;

export interface Prefs {
  sound: boolean;
  /** 0..1 */
  music: number;
  /** the player moved the music slider at least once: music holds its stored value even at 0 or at OLD_DEFAULT_MUSIC */
  musicSet: boolean;
  /** ambience plays every bed (Settings "Ambience: Full") rather than just the quiet default (AMBIENT_LIGHT_CAPS) */
  ambienceFull: boolean;
  guideHidden: boolean;
  /** Menu → Show path: off (wayfinding's ground path hint; on by default) */
  pathHidden: boolean;
  /** the guide's one-off note after the first bark (src/barks.ts) has been shown */
  barkHint?: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true, music: 0.6, musicSet: false, ambienceFull: false, guideHidden: false, pathHidden: false };

export function loadPrefs(kv: KeyValue): Prefs {
  try {
    const d = JSON.parse(kv.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!d || typeof d !== "object") return { ...DEFAULT_PREFS };
    const musicSet = d.musicSet === true;
    const storedMusic = typeof d.music === "number" && d.music >= 0 && d.music <= 1 ? d.music : undefined;
    // musicSet: honour whatever was stored (even 0, even the old default). Not musicSet: a prefs
    // blob from before this flag existed; 0 and 0.8 were both shipped defaults, while another
    // valid value records a real legacy slider choice.
    const historicalDefault = storedMusic === 0 || storedMusic === OLD_DEFAULT_MUSIC;
    const music = musicSet ? (storedMusic ?? DEFAULT_PREFS.music) : storedMusic !== undefined && !historicalDefault ? storedMusic : DEFAULT_PREFS.music;
    return {
      sound: typeof d.sound === "boolean" ? d.sound : DEFAULT_PREFS.sound,
      music,
      musicSet,
      ambienceFull: typeof d.ambienceFull === "boolean" ? d.ambienceFull : DEFAULT_PREFS.ambienceFull,
      guideHidden: typeof d.guideHidden === "boolean" ? d.guideHidden : DEFAULT_PREFS.guideHidden,
      pathHidden: typeof d.pathHidden === "boolean" ? d.pathHidden : DEFAULT_PREFS.pathHidden,
      ...(d.barkHint === true ? { barkHint: true } : {}),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(kv: KeyValue, p: Prefs): boolean {
  try {
    kv.setItem(PREFS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
