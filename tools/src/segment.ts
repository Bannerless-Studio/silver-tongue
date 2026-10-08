import type { Token } from "@silver-tongue/core";
import type { PackWord } from "./pack";

export interface Lexicon {
  byForm: Map<string, string>;
  maxLen: number;
  /** a homograph word (see PackWord.homograph) -> its forms, tagged only where a line marks them */
  marked: Map<string, Set<string>>;
}

/** Throws if two words share a form, unless one is a homograph: the tagger couldn't tell them apart. */
export function buildLexicon(words: PackWord[]): Lexicon {
  const byForm = new Map<string, string>();
  const marked = new Map<string, Set<string>>();
  const clashes: string[] = [];
  let maxLen = 1;
  for (const w of words) {
    const formKeys = Object.keys(w.forms ?? {});
    for (const f of formKeys) if (w.alt?.includes(f)) clashes.push(`"${f}" (${w.id}: both alt and forms)`);
    const forms = new Set([w.w, ...(w.alt ?? []), ...formKeys]);
    if (w.homograph) {
      marked.set(w.id, forms);
      continue;
    }
    for (const form of forms) {
      const other = byForm.get(form);
      if (other !== undefined && other !== w.id) clashes.push(`"${form}" (${other}, ${w.id})`);
      else byForm.set(form, w.id);
      maxLen = Math.max(maxLen, form.length);
    }
  }
  if (clashes.length) throw new Error(`words share a form, so lines can't be tagged: ${clashes.join(", ")}`);
  return { byForm, maxLen, marked };
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

/** `<spelling>[<id>]`: the id of a homograph word (see PackWord.homograph) right after its spelling. */
const MARK = /\[([^\[\]\s]+)\]/g;

/**
 * segment, for a line that may mark homographs (하나만[ko-only] 주세요): each mark is taken out of the
 * text and the spelling before it tagged as the word it names; the text between marks is segmented as
 * usual. `problems`: a mark naming no homograph, or not right after one of its spellings.
 */
export function segmentMarked(text: string, lex: Lexicon): { text: string; tokens: Token[]; unknown: Unknown[]; problems: string[] } {
  const tokens: Token[] = [];
  const unknown: Unknown[] = [];
  const problems: string[] = [];
  let out = "";
  let from = 0;
  const plain = (piece: string) => {
    const s = segment(piece, lex);
    const shift = out.length;
    tokens.push(...s.tokens.map((t) => ({ ...t, start: t.start + shift, end: t.end + shift })));
    unknown.push(...s.unknown.map((u) => ({ ...u, start: u.start + shift, end: u.end + shift })));
    out += piece;
  };
  for (const m of text.matchAll(MARK)) {
    const forms = lex.marked.get(m[1]);
    if (!forms) {
      problems.push(`[${m[1]}] marks no homograph word`);
      continue;
    }
    const before = text.slice(from, m.index);
    const form = [...forms].sort((a, b) => b.length - a.length).find((f) => before.endsWith(f));
    if (!form) {
      problems.push(`[${m[1]}] doesn't follow one of its spellings (${[...forms].join(", ")})`);
      plain(before);
    } else {
      plain(before.slice(0, before.length - form.length));
      tokens.push({ start: out.length, end: out.length + form.length, word: m[1] });
      out += form;
    }
    from = m.index + m[0].length;
  }
  plain(text.slice(from));
  return { text: out, tokens, unknown, problems };
}
