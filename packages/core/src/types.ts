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

export interface World {
  start: string;
  currency: string;
  slotsPerDay: number;
  startWallet: number;
  foodPerDay: number;
  rentPerWeek: number;
  places: Record<string, Place>;
  npcs: Record<string, Npc>;
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
  /** learner-language Fluent source: UI text and narration */
  learnerFtl: string;
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
}

export type Input =
  | { type: "goTo"; place: string }
  | { type: "startScene"; scene: string }
  | { type: "reply"; choice: number }
  | { type: "replyTiles"; tiles: number[] }
  | { type: "helpWord"; word: WordId }
  | { type: "sleep" };

export type GameEvent =
  | { type: "placeEntered"; place: string }
  | { type: "sceneStarted"; scene: string; npc: string }
  | { type: "lineSpoken"; npc: string; line: RenderedLine }
  | { type: "replyOptions"; mode: "pick"; options: RenderedLine[] }
  | { type: "replyOptions"; mode: "tiles"; tiles: string[] }
  | { type: "actionPerformed"; action: Record<string, string>; matched: boolean; diff: string[] }
  | { type: "npcReacted"; npc: string; reaction: string; line: RenderedLine }
  | { type: "lineRephrased"; npc: string; line: RenderedLine }
  | { type: "walletChanged"; wallet: number; delta: number; reason: string }
  | { type: "trustChanged"; npc: string; trust: number }
  | { type: "wordStateChanged"; word: WordId; from: WordState; to: WordState }
  | { type: "sceneEnded"; scene: string; earned: number }
  | { type: "unlocked"; scene: string }
  | { type: "rankChanged"; rank: number }
  | { type: "dayEnded"; day: number }
  | { type: "inputRejected"; reason: string };
