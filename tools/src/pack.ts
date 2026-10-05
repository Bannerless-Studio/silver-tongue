/** Our language-pack format (content/languages/<key>/). */
export interface PackMeta {
  key: string;
  name: string;
  /** Intl locale used for Fluent plural rules, e.g. "zh", "es" */
  locale: string;
  /** speech-synthesis locale for audio, e.g. "zh-CN" */
  tts: string;
  ttsRate?: number;
  levels: string[];
  /** stage number -> the pack levels it covers */
  stages: Record<string, string[]>;
  /** typed-reply rules as vocab-engine writes them; null when the script can't be typed */
  typing: Record<string, unknown> | null;
  /** true when the script separates words with spaces */
  spaced: boolean;
  /** "rtl" for a right-to-left script; absent means left to right */
  direction?: "ltr" | "rtl";
  /** what goes between two reply tiles when shown, for an unspaced language that writes spaces between words; "" when absent */
  tileGap?: string;
  /** true: the course uses the Book (readings under words, Letters and Papers tabs); absent means the notebook as it was */
  book?: boolean;
  /** true: the course uses the player's inner voice; absent leaves the presentation unchanged */
  voice?: boolean;
  /**
   * How readings run together inside one written word (see the view's joinReadings): when the next
   * reading starts with one of `before`, a reading ending in a key of `finals` ends in its value instead
   * (a final consonant carried over to the next syllable). Absent: readings are joined as they are.
   */
  liaison?: Liaison;
}

export interface Liaison {
  before: string;
  finals: Record<string, string>;
}

export interface PackWord {
  id: string;
  w: string;
  lv: string;
  alt?: string[];
  pron?: string;
  /** readings, most native first; overrides pron */
  readings?: string[];
  /** readings of each other spelling (a conjugation, a kana spelling), most native first; each key is also a form the tagger knows */
  forms?: Record<string, string[]>;
  /** what text-to-speech reads for the word's own clip, when it misreads the spelling alone (は → わ) */
  say?: string;
  pos?: string;
  bonus?: boolean;
  /** a particle or ending written glued to the word before it (display only) */
  attach?: boolean;
  /** a person's name: counted as a word, never as new vocabulary (the learning report's new-word cap) */
  name?: boolean;
}

/** The subset of a vocab-engine pack we read. */
export interface VocabPackJson {
  key: string;
  name: string;
  tts: string;
  ttsRate?: number;
  langTag?: string;
  levels: { id: string; label: string }[];
  typing?: Record<string, unknown> | null;
  spaced?: boolean;
}

export interface VocabWordJson {
  id: string;
  w: string;
  en: string;
  lv: string;
  alt?: string[];
  pron?: string;
  /** readings, most native first; overrides pron */
  readings?: string[];
  pos?: string;
}
