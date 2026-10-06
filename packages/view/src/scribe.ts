// Scribe mode (lab): in the first conversations the player reads their line in Latin letters and types what it means,
// then says a reply by typing its meaning. Pure rules and wording here; the page draws it (quiet-web/src/ui/Scribe.tsx).
import { personalize, type RenderedLine, type WordId } from "@silver-tongue/core";
import { romanize } from "./desk";


/** The scenes played in scribe mode; every later scene keeps the normal flow. */
export const SCRIBE_SCENES: readonly string[] = ["room-wake", "street-hello", "stall-lead", "street-introductions"];

export const isScribeScene = (scene: string | undefined): boolean => !!scene && SCRIBE_SCENES.includes(scene);

/** The hands-off arc, in one place: the first exchanges light the help button at the first miss, the later ones after SCRIBE_HELP_LATE. */
export const SCRIBE_EARLY_EXCHANGES = 2;
export const SCRIBE_HELP_LATE = 3;
/** Misses on one field before its help button lights. `index`: how many scribe exchanges this course has begun before this one. */
export const scribeHelpAfter = (index: number): number => (index < SCRIBE_EARLY_EXCHANGES ? 1 : SCRIBE_HELP_LATE);
/** Only the very first scribe exchange shows its worked example. */
export const scribeShowsExample = (index: number): boolean => index === 0;

/** Where the page keeps how many scribe exchanges a course has begun (the worked example is the first's alone). */
export const scribeCountKey = (course: string): string => `silver-tongue:scribe-count:${course}`;

/** Authored visible-word fragments and essential distinctions, keyed by scene and source line.
 * `meaning` is checked against current content to catch stale rules. No global pronoun removal.
 */
export const SCRIBE_ACCEPTS: Record<string, { meaning: string; fragments: string[] }> = {
  "room-wake:call": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "room-wake:call-reply": {"meaning": "No.", "fragments": ["no"]},
  "room-wake:call-alt1": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "room-wake:friend": {"meaning": "Are you Min-jun's friend?", "fragments": ["minjun friend", "min-jun's friend?", "are you a friend of min-jun"]},
  "room-wake:friend-reply": {"meaning": "Yes.", "fragments": ["yes"]},
  "room-wake:friend-alt1": {"meaning": "No.", "fragments": ["no"]},
  "room-wake:friend-alt2": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "room-wake:missing": {"meaning": "Where's Min-jun?", "fragments": ["where minjun", "where is min jun"]},
  "room-wake:missing-reply": {"meaning": "I don't know.", "fragments": ["not know", "no idea", "dunno"]},
  "room-wake:missing-alt1": {"meaning": "I'm Min-jun's friend.", "fragments": ["minjun friend", "friend"]},
  "room-wake:missing-alt2": {"meaning": "Yes.", "fragments": ["yes"]},
  "street-hello:hello": {"meaning": "Hello.", "fragments": ["hello", "good morning", "good day"]},
  "street-hello:hello-reply": {"meaning": "Hello.", "fragments": ["hello", "good morning", "good day"]},
  "street-hello:hello-alt1": {"meaning": "No.", "fragments": ["no"]},
  "street-hello:hello-alt2": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "street-hello:idcard": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "street-hello:idcard-reply": {"meaning": "Yes.", "fragments": ["yes"]},
  "street-hello:idcard-alt1": {"meaning": "No.", "fragments": ["no"]},
  "street-hello:idcard-alt2": {"meaning": "I don't know.", "fragments": ["not know", "no idea", "dunno"]},
  "stall-lead:recognition": {"meaning": "Yes.", "fragments": ["yes"]},
  "stall-lead:recognition-reply": {"meaning": "Yes.", "fragments": ["yes"]},
  "stall-lead:recognition-alt1": {"meaning": "No.", "fragments": ["no"]},
  "stall-lead:recognition-alt2": {"meaning": "I don't know.", "fragments": ["not know", "no idea", "dunno"]},
  "street-introductions:park": {"meaning": "I'm Grandpa Park.", "fragments": ["park grandpa", "grandfather park", "i am grandfather park", "he is park", "i am park"]},
  "street-introductions:park-reply": {"meaning": "Hello, Grandpa Park.", "fragments": ["hello", "hello grandfather park", "hello grandpa", "hello park"]},
  "street-introductions:park-alt1": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "street-introductions:park-alt2": {"meaning": "No.", "fragments": ["no"]},
  "street-introductions:who": {"meaning": "Who are you?", "fragments": ["who", "who is it", "who is there"]},
  "street-introductions:who-reply": {"meaning": "I'm { $player }.", "fragments": ["{player}"]},
  "street-introductions:who-alt1": {"meaning": "I'm Min-jun.", "fragments": ["minjun", "min jun"]},
  "street-introductions:who-alt2": {"meaning": "Are you Min-jun's friend?", "fragments": ["minjun friend", "min-jun's friend?", "are you a friend of min-jun"]},
  "street-introductions:ask": {"meaning": "What's your name?", "fragments": ["name what", "your name", "what are you called"]},
  "street-introductions:ask-reply": {"meaning": "I'm { $player }.", "fragments": ["{player}"]},
  "street-introductions:ask-alt1": {"meaning": "I'm Min-jun.", "fragments": ["minjun", "min jun"]},
  "street-introductions:ask-alt2": {"meaning": "I'm Min-jun's friend.", "fragments": ["minjun friend", "friend"]},
  "street-introductions:sit": {"meaning": "Have a seat.", "fragments": ["sit", "sit down", "sit down here", "have a seat", "take a seat", "please sit"]},
  "street-introductions:sit-reply": {"meaning": "Thank you.", "fragments": ["thank you", "thank you very much", "thanks a lot", "thank you so much"]},
  "street-introductions:sit-alt1": {"meaning": "Min-jun?", "fragments": ["minjun", "min jun"]},
  "street-introductions:sit-alt2": {"meaning": "Who is it?", "fragments": ["who", "who is there"]},
  "street-introductions:understand": {"meaning": "Do you know Korean?", "fragments": ["know korean", "speak korean", "do you speak korean", "can you speak korean", "do you understand korean"]},
  "street-introductions:understand-reply": {"meaning": "No, I don't.", "fragments": ["no", "not know", "i do not speak korean"]},
  "street-introductions:understand-alt1": {"meaning": "Yes, I do.", "fragments": ["yes", "i do", "yes i speak korean"]},
  "street-introductions:understand-alt2": {"meaning": "Yes, thank you.", "fragments": ["yes thank you"]},
  "street-introductions:bye": {"meaning": "Goodbye.", "fragments": ["goodbye", "see you", "farewell"]},
  "street-introductions:bye-reply": {"meaning": "Goodbye.", "fragments": ["goodbye", "see you", "farewell"]},
  "street-introductions:bye-alt1": {"meaning": "Yes, I do.", "fragments": ["yes", "i do", "yes i speak korean"]},
  "street-introductions:bye-alt2": {"meaning": "No, I don't.", "fragments": ["no", "not know", "i do not speak korean"]},
};

export function scribeAccepts(scene: string, line: string, player = "?"): string[] {
  return (SCRIBE_ACCEPTS[`${scene}:${line}`]?.fragments ?? []).map((s) => s.replaceAll("{player}", player));
}

/** Map a rendered reply back to its source ID, independent of shuffled slip order. */
export function scribeReplyId(course: import("@silver-tongue/core").Course, scene: string, exchange: string, line: RenderedLine, player = "?"): string {
  const ex = course.scenes.find((s) => s.id === scene)?.exchanges.find((e) => e.id === exchange);
  for (const v of Object.values(ex?.variants ?? {})) {
    // Player names may have been personalised by core; the other lines are fixed.
    if (personalize(v.reply, player).text === line.text && v.reply.intent === line.intent) return `${exchange}-reply`;
    const i = v.alts?.findIndex((l) => personalize(l, player).text === line.text && l.intent === line.intent) ?? -1;
    if (i >= 0) return `${exchange}-alt${i + 1}`;
  }
  return `${exchange}-reply`;
}

/** A piece of a line in Latin letters: a word (with its id, so a tap can look it up) or what lies between words. */
export interface RomanSeg {
  text: string;
  word?: WordId;
  /** the word as written in Hangul, for its look-up card */
  surface?: string;
  /** Index into the original tokens, shared with soundedTokens. */
  token?: number;
}

const isHangul = (ch: string | undefined): boolean => !!ch && /[\uac00-\ud7a3]/.test(ch);

/**
 * A line read in Latin letters, one piece per word. Each word is romanised by itself so a tap maps to its id; the gaps
 * (spaces, punctuation) pass through. A sentence starts with a capital, as written, and a name set in Latin letters
 * (the player's) is kept apart from the Hangul after it. The desk's `romanize` is used as it is.
 */
export function romanSegments(line: RenderedLine): RomanSeg[] {
  const out: RomanSeg[] = [];
  const text = line.text;
  const push = (from: number, to: number, word?: WordId) => {
    if (isHangul(text[from]) && /[A-Za-z0-9]/.test(text[from - 1] ?? "")) out.push({ text: " " });
    out.push({ text: romanize(text.slice(from, to)).replace(/…{2,}/g, "…"), ...(word !== undefined ? { word, surface: text.slice(from, to) } : {}) });
  };
  let at = 0;
  for (const tk of [...line.tokens].sort((a, b) => a.start - b.start)) {
    if (tk.start > at) push(at, tk.start);
    push(tk.start, tk.end, tk.word);
    out[out.length - 1].token = line.tokens.indexOf(tk);
    at = tk.end;
  }
  if (at < text.length) push(at, text.length);
  // Capitals: the first letter, and the first after a sentence's end.
  let start = true;
  return out.map((seg) => {
    let t = "";
    for (const ch of seg.text) {
      if (start && /\p{L}/u.test(ch)) (t += ch.toUpperCase()), (start = false);
      else t += ch;
      if (/[.?!]/.test(ch)) start = true;
    }
    return { ...seg, text: t };
  });
}

/** `romanSegments` as one string. */
export const romanLine = (line: RenderedLine): string => romanSegments(line).map((s) => s.text).join("");

/** A line's meaning as the learner reads it (core has put the player's name in), or "" when it has none. */
export const lineMeaning = (line: RenderedLine): string => line.meaning ?? "";


type Words = Record<WordId, { first?: { line: string }; right: number } | undefined>;

/**
 * Words of their line that are new to the player: core records a word when it is first heard (`first` = that line), so a
 * word is new while the line it first came on is still on stage and it has not been got right since. `origin` is the
 * line as first said when `line` is a rephrase of it. Such a word shows its gloss under the line, help or not.
 */
export function freshOnTheirLine(line: RenderedLine, words: Words, origin: RenderedLine = line): Set<WordId> {
  const out = new Set<WordId>();
  for (const tk of line.tokens) {
    const rec = words[tk.word];
    if (!rec || (rec.first?.line === origin.text && rec.right === 0)) out.add(tk.word);
  }
  return out;
}

/**
 * Words of a reply slip that are new: core records a reply's words only when that reply is said (or it was heard in a line),
 * so a word with no `first` has never been met. Said once, it is not new on the next exchange.
 */
export function freshOnReply(line: RenderedLine, words: Words): Set<WordId> {
  return new Set(line.tokens.filter((tk) => !words[tk.word]?.first).map((tk) => tk.word));
}
