// Matching what a player typed against a line's English meaning, leniently: contractions, case, accents,
// punctuation, small words and a few spellings of the same thing ("thanks", "bye") do not matter. Pure.

/** Spellings that mean the same: applied to both sides, whole words, after contractions. */
const SYNONYMS: [RegExp, string][] = [
  [/\bthanks\b|\bthankyou\b|\bthank-you\b/g, "thank you"],
  [/\bgood bye\b|\bbye\b|\bbyebye\b/g, "goodbye"],
  [/\bhi\b|\bhey\b|\bhiya\b/g, "hello"],
  [/\bnope\b/g, "no"],
  [/\byeah\b|\byep\b|\byup\b/g, "yes"],
];

/** Contractions, with or without the apostrophe (a phone keyboard drops it). Each is whole-word. */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon'?t\b/g, "will not"],
  [/\bcan'?t\b/g, "can not"],
  [/\b(do|does|did|is|are|was|were|has|have|had|would|could|should)n'?t\b/g, "$1 not"],
  [/\bi'?m\b/g, "i am"],
  [/\b(you|we|they)'?re\b/g, "$1 are"],
  [/\b(he|she|it|that|who|what|where|there|here|how)'s\b/g, "$1 is"],
  [/\b(who|what|where|that|there)s\b/g, "$1 is"],
  [/\blet'?s\b/g, "let us"],
  [/\b(\w+)'ll\b/g, "$1 will"],
  [/\b(\w+)'ve\b/g, "$1 have"],
];

/** Words that carry no meaning of their own here; a line's meaning is its other words. */
const STOP = new Set("a an the is are am be it its i well oh um uh ah hmm do does did to of so please just".split(" "));
/** Negations are never small words: leaving one out, or adding one, says the opposite. */
const NEG = new Set(["no", "not", "never", "nothing", "none"]);
/** Content words typed beyond the meaning's own that still count as the same sentence. */
const EXTRA_WORDS = 2;

/** Lowercase, no accents, contractions spelled out, no punctuation, one space between words. */
export function normalizeMeaning(text: string): string {
  let s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/(\p{L})-(\p{L})/gu, "$1$2");
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  s = s.replace(/'s\b/g, "").replace(/'/g, "");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ");
  for (const [re, to] of SYNONYMS) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

/** The words of a normalised text that matter, each once. */
export function contentWords(norm: string): string[] {
  return [...new Set(norm.split(" ").filter((w) => w && (!STOP.has(w) || NEG.has(w))))];
}

/**
 * How well typed text says a meaning: 0 for the same words (or one of `accepts`), 1 + the number of extra content words for
 * a looser match, undefined when it does not match. Lower is better.
 */
export function meaningScore(typed: string, meaning: string, accepts: readonly string[] = []): number | undefined {
  const t = normalizeMeaning(typed);
  if (!t) return undefined;
  const m = normalizeMeaning(meaning);
  if (t === m || accepts.some((a) => normalizeMeaning(a) === t)) return 0;
  // "min jun" for "min-jun", and a word said twice once
  const squash = (x: string) => [...new Set(x.split(" "))].join("");
  if (m && squash(t) === squash(m)) return 0;
  const need = contentWords(m);
  if (!need.length) return undefined;
  const have = contentWords(t);
  if (!need.every((w) => have.includes(w))) return undefined;
  const extra = have.filter((w) => !need.includes(w));
  if (extra.some((w) => NEG.has(w))) return undefined;
  return extra.length <= EXTRA_WORDS ? 1 + extra.length : undefined;
}

/** Whether typed text says the meaning (see meaningScore). `accepts`: other ways to say it, each matched whole. */
export function meaningMatches(typed: string, meaning: string, accepts: readonly string[] = []): boolean {
  return meaningScore(typed, meaning, accepts) !== undefined;
}

/** The candidate the typed text says best, or -1. A tie goes to the earlier candidate (give them in the order to prefer). */
export function bestMeaning(typed: string, candidates: readonly { meaning: string; accepts?: readonly string[] }[]): number {
  let best = -1;
  let score = Infinity;
  candidates.forEach((c, i) => {
    const s = meaningScore(typed, c.meaning, c.accepts);
    if (s !== undefined && s < score) (best = i), (score = s);
  });
  return best;
}
