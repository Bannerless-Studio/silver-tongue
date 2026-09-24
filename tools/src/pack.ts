/** Our language-pack format (content/languages/<key>/). */
export interface PackMeta {
  key: string;
  name: string;
  /** Intl locale used for Fluent plural rules, e.g. "zh", "es" */
  locale: string;
  levels: string[];
  /** stage number -> the pack levels it covers */
  stages: Record<string, string[]>;
  typing: boolean;
  /** true when the script separates words with spaces */
  spaced: boolean;
}

export interface PackWord {
  id: string;
  w: string;
  lv: string;
  alt?: string[];
  pron?: string;
  pos?: string;
  bonus?: boolean;
}

/** The subset of a vocab-engine pack we read. */
export interface VocabPackJson {
  key: string;
  name: string;
  tts: string;
  langTag?: string;
  levels: { id: string; label: string }[];
  typing?: object | null;
  spaced?: boolean;
}

export interface VocabWordJson {
  id: string;
  w: string;
  en: string;
  lv: string;
  alt?: string[];
  pron?: string;
  pos?: string;
}
