export type WordId = string;

export interface Word {
  id: WordId;
  w: string;
  pron?: string;
  lv: string;
  gloss: string;
  bonus?: boolean;
}

/** A word's position in a line. Offsets are UTF-16 indices, `end` exclusive. */
export interface Token {
  start: number;
  end: number;
  word: WordId;
}

export interface RenderedLine {
  text: string;
  tokens: Token[];
  audio?: string;
  /** what the whole line means, in the learner's language */
  meaning?: string;
}

export interface Variant {
  npc: RenderedLine;
  reply: RenderedLine;
  rephrase?: RenderedLine;
}

export interface Exchange {
  id: string;
  /** slot name -> group name */
  slots: Record<string, string>;
  /** action parameters; a value "$slot" refers to a slot */
  expect: Record<string, string>;
  /** "$slot" or a concept name */
  hinges: string[];
  pay: number;
  missCost: number;
  /** keyed by comboKey(combo); "" when the exchange has no slots */
  variants: Record<string, Variant>;
}

export interface Scene {
  id: string;
  place: string;
  npc: string;
  stage: number;
  after: string[];
  requires: { trust?: Record<string, number> };
  repeatable: boolean;
  trustGain: number;
  exchanges: Exchange[];
}

export interface Place {
  links: string[];
}

export interface Npc {
  place: string;
}

/** The NPC who explains usage notes, once the scene `after` is done. */
export interface Mentor {
  npc: string;
  after: string;
}

export interface World {
  start: string;
  currency: string;
  slotsPerDay: number;
  startWallet: number;
  foodPerDay: number;
  rentPerWeek: number;
  places: Record<string, Place>;
  npcs: Record<string, Npc>;
  mentor?: Mentor;
}

/** A usage note the mentor explains once its trigger is met: a word seen, or a scene done. */
export interface Note {
  id: string;
  trigger: { word: WordId } | { scene: string };
}

/** Built course output: everything the game loads. */
export interface Course {
  id: string;
  typing: boolean;
  words: Record<WordId, Word>;
  /** concept -> the word ids its base form is made of */
  concepts: Record<string, WordId[]>;
  /** group -> concepts */
  groups: Record<string, string[]>;
  world: World;
  scenes: Scene[];
  reactions: Record<string, RenderedLine>;
  /** learner-language Fluent source: UI text, narration and mentor notes */
  learnerFtl: string;
  /** concept -> its name in the learner's language, for narration ("tea") */
  conceptNames: Record<string, string>;
  /** stage -> every word id on that stage's word list, including words no scene uses yet */
  stageWords: Record<string, WordId[]>;
  /** in the order the mentor explains them */
  notes: Note[];
}

export type WordState = "unseen" | "met" | "shaky" | "known";
export type ReplyMode = "pick" | "tiles" | "type";

export interface WordRecord {
  right: number;
  wrong: number;
  streak: number;
  helps: number;
  /** missed or helped since the last correct answer */
  lapsed: boolean;
  firstSeen: number;
  lastSeen: number;
  /** the line the word was first heard in, and where */
  first?: { line: string; place: string };
}

export interface SceneRun {
  scene: string;
  exchange: number;
  combo: Record<string, string>;
  mode: ReplyMode;
  /** pick mode: combo keys in display order */
  options: string[];
  /** tiles mode: tile texts in display order */
  tiles: string[];
  misses: number;
  earned: number;
  mixups: number;
}

/** One accepted input, for play-tests. */
export interface LogEntry {
  t: number;
  day: number;
  slot: number;
  input: Input;
}

export interface GameState {
  v: 1;
  course: string;
  day: number;
  slot: number;
  wallet: number;
  rentLate: boolean;
  place: string;
  trust: Record<string, number>;
  words: Record<WordId, WordRecord>;
  scenesDone: Record<string, number>;
  run: SceneRun | null;
  /** mentor notes: triggered and waiting (ready), and explained (read) */
  notes: { ready: string[]; read: string[] };
  /** the last accepted inputs, newest last */
  log: LogEntry[];
}

/** Why the core refused an input. Front ends show a translated message for each. */
export const REJECT_REASONS = [
  "unknown-scene",
  "in-scene",
  "wrong-place",
  "locked",
  "no-slots",
  "stale-run",
  "no-pick",
  "bad-choice",
  "no-tiles",
  "bad-tile",
  "not-linked",
  "unknown-word",
  "no-mentor",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Why the wallet changed. */
export const WALLET_REASONS = ["wages", "mixup", "food", "rent"] as const;
export type WalletReason = (typeof WALLET_REASONS)[number];

/** Replies arrive as `reply` (pick mode) or `replyTiles` (tiles mode); typed replies will add `replyText`. */
export type Input =
  | { type: "goTo"; place: string }
  | { type: "startScene"; scene: string }
  | { type: "reply"; choice: number }
  | { type: "replyTiles"; tiles: number[] }
  | { type: "helpWord"; word: WordId }
  | { type: "visitMentor" }
  | { type: "sleep" };

export type GameEvent =
  | { type: "placeEntered"; place: string }
  | { type: "sceneStarted"; scene: string; npc: string }
  | { type: "lineSpoken"; npc: string; line: RenderedLine }
  | { type: "replyOptions"; mode: "pick"; options: RenderedLine[] }
  | { type: "replyOptions"; mode: "tiles"; tiles: string[] }
  /**
   * action: what the player's reply did. expected: what the NPC asked for.
   * diff: the slots the player got wrong (pick mode). tilesWrong: the tiles didn't make the reply
   * (tiles mode, where the slots are always the expected ones).
   */
  | {
      type: "actionPerformed";
      action: Record<string, string>;
      expected: Record<string, string>;
      matched: boolean;
      diff: string[];
      tilesWrong: boolean;
    }
  | { type: "npcReacted"; npc: string; reaction: string; line: RenderedLine }
  /** slow: no rephrase was written, so this replays the original line (show it slowly, with pronunciation) */
  | { type: "lineRephrased"; npc: string; line: RenderedLine; slow: boolean }
  | { type: "walletChanged"; wallet: number; delta: number; reason: WalletReason }
  | { type: "trustChanged"; npc: string; trust: number }
  | { type: "wordStateChanged"; word: WordId; from: WordState; to: WordState }
  | { type: "sceneEnded"; scene: string; earned: number }
  | { type: "unlocked"; scene: string }
  | { type: "rankChanged"; rank: number }
  | { type: "dayEnded"; day: number }
  /** a mentor note's trigger was met; the mentor can now explain it */
  | { type: "noteReady"; note: string }
  /** notes: the notes explained on this visit, in order; empty when there was nothing new */
  | { type: "mentorVisited"; npc: string; notes: string[] }
  | { type: "inputRejected"; reason: RejectReason };
