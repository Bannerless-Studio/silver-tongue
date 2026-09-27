import type { Token } from "@silver-tongue/core";
import type { PackWord } from "./pack";

export interface Lexicon {
  byForm: Map<string, string>;
  maxLen: number;
}

/** Throws if two words share a form: the tagger couldn't tell them apart. */
export function buildLexicon(words: PackWord[]): Lexicon {
  const byForm = new Map<string, string>();
  const clashes: string[] = [];
  let maxLen = 1;
  for (const w of words) {
    const formKeys = Object.keys(w.forms ?? {});
    for (const f of formKeys) if (w.alt?.includes(f)) clashes.push(`"${f}" (${w.id}: both alt and forms)`);
    for (const form of new Set([w.w, ...(w.alt ?? []), ...formKeys])) {
      const other = byForm.get(form);
      if (other !== undefined && other !== w.id) clashes.push(`"${form}" (${other}, ${w.id})`);
      else byForm.set(form, w.id);
      maxLen = Math.max(maxLen, form.length);
    }
  }
  if (clashes.length) throw new Error(`words share a form, so lines can't be tagged: ${clashes.join(", ")}`);
  return { byForm, maxLen };
}

/** Punctuation, symbols, spaces, digits and the player-name mark are not words. */
const SKIP = /^[\p{P}\p{S}\p{Z}\s\p{Nd}\uE000]$/u;

export interface Unknown {
  start: number;
  end: number;
  char: string;
}

interface Best {
  unknown: number;
  words: number;
  from: number;
  word?: string;
}

const better = (a: Best, b: Best | undefined) =>
  !b || a.unknown < b.unknown || (a.unknown === b.unknown && a.words < b.words);

/**
 * Word tagging for unspaced scripts (Chinese, Japanese). Picks the split with the fewest
 * characters outside the word list, then the fewest words, so 研究生命 is 研究 + 生命 when
 * both are words, not 研究生 + 命. On a tie the split whose last word is longer wins.
 * Offsets are UTF-16 indices; unknown characters are whole code points.
 */
export function segment(text: string, lex: Lexicon): { tokens: Token[]; unknown: Unknown[] } {
  const n = text.length;
  const best: (Best | undefined)[] = new Array(n + 1);
  best[0] = { unknown: 0, words: 0, from: -1 };
  const offer = (j: number, b: Best) => {
    if (better(b, best[j])) best[j] = b;
  };
  for (let i = 0; i < n; i++) {
    const cur = best[i];
    if (!cur) continue;
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const next = i + char.length;
    if (SKIP.test(char)) {
      offer(next, { unknown: cur.unknown, words: cur.words, from: i });
      continue;
    }
    for (let len = 1; len <= Math.min(lex.maxLen, n - i); len++) {
      const id = lex.byForm.get(text.slice(i, i + len));
      if (id) offer(i + len, { unknown: cur.unknown, words: cur.words + 1, from: i, word: id });
    }
    offer(next, { unknown: cur.unknown + 1, words: cur.words, from: i });
  }
  const tokens: Token[] = [];
  const unknown: Unknown[] = [];
  for (let j = n; j > 0; ) {
    const b = best[j]!;
    const piece = text.slice(b.from, j);
    if (b.word) tokens.push({ start: b.from, end: j, word: b.word });
    else if (!SKIP.test(piece)) unknown.push({ start: b.from, end: j, char: piece });
    j = b.from;
  }
  return { tokens: tokens.reverse(), unknown: unknown.reverse() };
}
