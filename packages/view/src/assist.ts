import { reviewDue, wordState, type Course, type GameEvent, type GameState, type RenderedLine, type WordId } from "@silver-tongue/core";
import { clock } from "./hud";
import { displayGloss, readingsOf, sentenceCard, type SentenceCard } from "./help";
import type { Text } from "./text";

/** A word as the helpers show it: as written, its plainest reading, and its short gloss. */
export interface WordLine {
  word: WordId;
  text: string;
  reading: string;
  gloss: string;
}

function wordLine(course: Course, word: WordId, surface?: string): WordLine {
  const w = course.words[word];
  const text = surface ?? w.w;
  return { word, text, reading: readingsOf(w, text).at(-1) ?? "", gloss: displayGloss(w) };
}

/** What a typed reply asks for: the setting's own words ("Type it in Chinese or pinyin:"), else the plain prompt. */
export function typePrompt(t: Text): string {
  return t.has("setting-type-prompt") ? t("setting-type-prompt") : t("type-prompt");
}

export type HintGiven = Extract<GameEvent, { type: "hintGiven" }>;

/** What a hint shows: its level (1-3), and a nudge, key words, or the reply. */
export type HintView =
  | { level: 1; text: string }
  | { level: 2; words: WordLine[] }
  | { level: 3; reply: SentenceCard | { text: string; reading: string; meaning: string; clips: string[] } };

export function hintView(course: Course, t: Text, e: HintGiven): HintView {
  if (e.level === 1) {
    const parts = [
      ...(e.intent ? [e.intent] : []),
      t(e.question ? "hint-question" : "hint-statement"),
      t("hint-words", { count: e.count }),
    ];
    return { level: 1, text: parts.join(" · ") };
  }
  if (e.level === 2) return { level: 2, words: e.words.map((w) => wordLine(course, w.word, w.text)) };
  return { level: 3, reply: sentenceCard(course, e.line) ?? { text: e.line.text, reading: "", meaning: "", clips: e.line.audio ?? [] } };
}

export type ReviewAsked = Extract<GameEvent, { type: "reviewAsked" }>;

export interface ReviewCard {
  n: number;
  of: number;
  /** the line around the blank */
  before: string;
  after: string;
  /** how wide the blank is drawn, in characters of the missing word */
  blank: string;
  /** the line's reading with the missing word's left out ("____"); "" when none */
  reading: string;
  meaning: string;
  options: WordLine[];
}

/** A review question: the line with its word left out, and the words to fill it with. */
export function reviewCard(course: Course, e: ReviewAsked): ReviewCard {
  const { line, blank } = e;
  const reading = line.tokens
    .map((tk) => (tk.start === blank.start ? "____" : (readingsOf(course.words[tk.word], line.text.slice(tk.start, tk.end)).at(-1) ?? "")))
    .filter(Boolean);
  return {
    n: e.n,
    of: e.of,
    before: line.text.slice(0, blank.start),
    after: line.text.slice(blank.end),
    blank: line.text.slice(blank.start, blank.end),
    reading: reading.some((r) => r !== "____") ? reading.join(" ") : "",
    meaning: line.meaning ?? "",
    options: e.options.map((w) => wordLine(course, w)),
  };
}

/** The review the menu offers: how many fading words it would ask about, or none. */
export function reviewOffer(course: Course, state: GameState, now: number): number {
  return Math.min(3, reviewDue(course, state, now).length);
}

/** One step of a job or an errand. */
export interface JobStep {
  label: string;
  status: "done" | "now" | "todo";
}

/** What the job panel shows while working: what the job is, where it's at, the time left, and words for it. */
export interface JobView {
  title: string;
  steps: JobStep[];
  /** time left in the day ("5:40"), while working a scene */
  timeLeft?: string;
  /** words of this job heard before but not known yet, at most 3 */
  words: WordLine[];
}

/** A scene that pays is work: its exchanges are the job's steps. */
const isJob = (course: Course, id: string) => !!course.scenes.find((s) => s.id === id)?.exchanges.some((ex) => ex.pay > 0);

/**
 * The job panel: while working a paid scene, its steps (one per exchange), the time left in the day
 * and up to three of its words the player has heard but doesn't know yet; while carrying a parcel,
 * the delivery's steps. Nothing otherwise.
 */
export function jobView(course: Course, state: GameState, t: Text, now: number): JobView | undefined {
  const run = state.run;
  if (run && isJob(course, run.scene)) {
    const scene = course.scenes.find((s) => s.id === run.scene)!;
    const steps: JobStep[] = scene.exchanges.map((_, i) => ({
      label: String(i + 1),
      status: i < run.exchange ? "done" : i === run.exchange ? "now" : "todo",
    }));
    const [h, m] = clock(course, state).split(":").map(Number);
    const left = Math.max(0, 20 * 60 - (h * 60 + m));
    const lines: RenderedLine[] = scene.exchanges.slice(run.exchange).flatMap((ex) => Object.values(ex.variants).flatMap((v) => [v.npc, v.reply]));
    const seen = new Set<WordId>();
    const words: WordLine[] = [];
    for (const l of lines)
      for (const tk of l.tokens) {
        const st = wordState(state.words[tk.word], now);
        if (seen.has(tk.word) || st === "unseen" || st === "known") continue;
        seen.add(tk.word);
        if (words.length < 3) words.push(wordLine(course, tk.word));
      }
    return { title: t(`scene-${scene.id}`), steps, timeLeft: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, words };
  }
  if (!run && state.errand) {
    return {
      title: t("job-delivery"),
      steps: [
        { label: t("job-step-pickup"), status: "done" },
        // At the right place the drop-off is on the menu anyway: the walk is done.
        { label: t("job-step-walk"), status: state.place === state.errand.to ? "done" : "now" },
        { label: t("job-step-handover"), status: state.place === state.errand.to ? "now" : "todo" },
      ],
      words: [],
    };
  }
  return undefined;
}
