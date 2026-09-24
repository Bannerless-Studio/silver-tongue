import type { Token } from "@silver-tongue/core";
import type { PackWord } from "./pack";

export interface Lexicon {
  byForm: Map<string, string>;
  maxLen: number;
}

export function buildLexicon(words: PackWord[]): Lexicon {
  const byForm = new Map<string, string>();
  let maxLen = 1;
  for (const w of words) {
    for (const form of [w.w, ...(w.alt ?? [])]) {
      if (!byForm.has(form)) byForm.set(form, w.id);
      maxLen = Math.max(maxLen, form.length);
    }
  }
  return { byForm, maxLen };
}

const SKIP = /[\p{P}\p{S}\p{Z}\s]/u;

/**
 * Longest-match segmentation for unspaced scripts (Chinese, Japanese).
 * Every non-punctuation character must belong to a pack word; the rest are reported.
 */
export function segment(text: string, lex: Lexicon): { tokens: Token[]; unknown: string[] } {
  const tokens: Token[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (SKIP.test(text[i])) {
      i += 1;
      continue;
    }
    let matched = 0;
    for (let len = Math.min(lex.maxLen, text.length - i); len > 0; len--) {
      const id = lex.byForm.get(text.slice(i, i + len));
      if (id) {
        tokens.push({ start: i, end: i + len, word: id });
        matched = len;
        break;
      }
    }
    if (matched) {
      i += matched;
    } else {
      unknown.push(text[i]);
      i += 1;
    }
  }
  return { tokens, unknown };
}
