import { newGame, parseSave, serialize, type Course, type GameState } from "@silver-tongue/core";
import { parseSettings, type PlayerSettings } from "@silver-tongue/view";

/** The part of localStorage the game uses; `keys` lists every stored key. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function fromLocalStorage(ls: Storage): KeyValue {
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
    keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)!),
  };
}

export interface Opened {
  id: string;
  state: GameState;
  /** a message id to show once, e.g. "notice-bad-save" */
  notice?: string;
  /** storage can't be used: play on without saving */
  readOnly: boolean;
}

export interface StoredSession {
  id: string;
  lastPlayed: number;
  state: GameState;
}

interface Meta {
  last?: string;
  played: Record<string, number>;
}

/** "2026-09-25-143005" (UTC), like the terminal game's session names. */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");

/**
 * Saved games in localStorage, one per session, like the terminal game's sessions folder:
 * `silver-tongue:<course>:session:<id>` holds a save, `…:meta` which one was played last and when.
 */
export class WebSessions {
  private prefix: string;

  constructor(
    private kv: KeyValue,
    private course: Course,
    private now: () => number,
  ) {
    this.prefix = `silver-tongue:${course.id}:`;
  }

  private meta(): Meta {
    return readMeta(this.kv, `${this.prefix}meta`);
  }

  private newId(): string {
    const base = stamp(this.now());
    let id = base;
    for (let n = 2; this.kv.getItem(`${this.prefix}session:${id}`) !== null; n++) id = `${base}-${n}`;
    return id;
  }

  /** Readable games, most recently played first. */
  list(): StoredSession[] {
    try {
      const played = this.meta().played;
      const out: StoredSession[] = [];
      for (const key of this.kv.keys()) {
        if (!key.startsWith(`${this.prefix}session:`)) continue;
        const id = key.slice(`${this.prefix}session:`.length);
        const parsed = parseSave(this.kv.getItem(key) ?? "", this.course);
        if (parsed.ok) out.push({ id, lastPlayed: played[id] ?? 0, state: parsed.state });
      }
      return out.sort((a, b) => b.lastPlayed - a.lastPlayed || b.id.localeCompare(a.id));
    } catch {
      return [];
    }
  }

  /** Opens a game; one that won't parse is kept as a backup and replaced by a new game. */
  open(id: string): Opened {
    try {
      const raw = this.kv.getItem(`${this.prefix}session:${id}`);
      if (raw === null) return { id, state: newGame(this.course), readOnly: false };
      const parsed = parseSave(raw, this.course);
      if (parsed.ok) return { id, state: parsed.state, readOnly: false };
      this.kv.setItem(`${this.prefix}invalid-backup:${id}:${stamp(this.now())}`, raw);
      this.kv.removeItem(`${this.prefix}session:${id}`);
      return { id, state: newGame(this.course), notice: "notice-bad-save", readOnly: false };
    } catch {
      return { id, state: newGame(this.course), notice: "notice-read-only", readOnly: true };
    }
  }

  /** The game played last, or a new one. */
  continueLast(): Opened {
    try {
      const last = this.meta().last;
      return this.open(last && this.kv.getItem(`${this.prefix}session:${last}`) !== null ? last : this.newId());
    } catch {
      return { id: "", state: newGame(this.course), notice: "notice-read-only", readOnly: true };
    }
  }

  /** A new game; it is stored on its first save. */
  startNew(): Opened {
    try {
      return { id: this.newId(), state: newGame(this.course), readOnly: false };
    } catch {
      return { id: "", state: newGame(this.course), notice: "notice-read-only", readOnly: true };
    }
  }

  /** Saves a game and marks it the one played last. Returns false if storage failed. */
  save(id: string, state: GameState): boolean {
    try {
      this.kv.setItem(`${this.prefix}session:${id}`, serialize(state));
      const meta = this.meta();
      meta.played[id] = this.now();
      meta.last = id;
      this.kv.setItem(`${this.prefix}meta`, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }

  /** Adds an imported game as a new session; its id, or null if storage failed. */
  add(state: GameState): string | null {
    try {
      const id = this.newId();
      return this.save(id, state) ? id : null;
    } catch {
      return null;
    }
  }
}

/** Where the player's settings live, apart from every course's games. */
export const SETTINGS_KEY = "silver-tongue:settings";

/** The player's settings; missing, unreadable or blocked storage means none. */
export function loadWebSettings(kv: KeyValue): PlayerSettings {
  try {
    return parseSettings(kv.getItem(SETTINGS_KEY));
  } catch {
    return {};
  }
}

export function saveWebSettings(kv: KeyValue, settings: PlayerSettings): boolean {
  try {
    kv.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** A meta entry as stored, or an empty one. */
function readMeta(kv: KeyValue, key: string): Meta {
  try {
    const m = JSON.parse(kv.getItem(key) ?? "null") as Meta | null;
    return m && typeof m === "object" && m.played && typeof m.played === "object" && !Array.isArray(m.played) ? m : { played: {} };
  } catch {
    return { played: {} };
  }
}

/**
 * Games saved under a course's earlier ids move to its own: sessions (renamed -2, -3, … on a clash),
 * backups, and which game was played last and when. If storage refuses, what couldn't move stays.
 */
export function migrateWebAliases(kv: KeyValue, course: { id: string; aliases?: string[] }): void {
  const to = `silver-tongue:${course.id}:`;
  for (const alias of course.aliases ?? []) {
    const from = `silver-tongue:${alias}:`;
    try {
      const keys = kv.keys().filter((k) => k.startsWith(from));
      if (!keys.length) continue;
      const oldMeta = readMeta(kv, `${from}meta`);
      const meta = readMeta(kv, `${to}meta`);
      // Whichever game was played last, under either id, stays the one played last.
      const at = (m: Meta, id?: string) => (id === undefined ? -1 : (m.played[id] ?? 0));
      const lastWins = oldMeta.last !== undefined && at(oldMeta, oldMeta.last) >= at(meta, meta.last);
      for (const key of keys) {
        const rest = key.slice(from.length);
        if (rest === "meta") continue;
        let target = `${to}${rest}`;
        if (rest.startsWith("session:")) {
          const id = rest.slice("session:".length);
          let newId = id;
          for (let n = 2; kv.getItem(`${to}session:${newId}`) !== null; n++) newId = `${id}-${n}`;
          target = `${to}session:${newId}`;
          kv.setItem(target, kv.getItem(key) ?? "");
          // The new meta is written with each game, so storage filling up midway loses no play times.
          if (oldMeta.played[id] !== undefined) meta.played[newId] = oldMeta.played[id];
          if (lastWins && id === oldMeta.last) meta.last = newId;
          try {
            kv.setItem(`${to}meta`, JSON.stringify(meta));
          } catch (e) {
            kv.removeItem(target); // not moved after all: it stays under the old id for next time
            throw e;
          }
        } else {
          for (let n = 2; kv.getItem(target) !== null; n++) target = `${to}${rest}-${n}`;
          kv.setItem(target, kv.getItem(key) ?? "");
        }
        kv.removeItem(key);
      }
      kv.removeItem(`${from}meta`);
    } catch {
      // storage refused: the old games stay where they are and move next time
    }
  }
}
