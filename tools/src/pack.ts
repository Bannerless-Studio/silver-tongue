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
