import type { RenderedLine } from "@silver-tongue/core";
import type { Beat } from "./quiet";

/**
 * The conversation stage of a course with the Book (spec 2026-09-29 section 12): one exchange on stage,
 * everything earlier in history. Pure: built from the transcript's beats each time it changes.
 */

/** One request of an NPC and what the player said to it. */
export interface Exchange {
  /** the NPC beat that first said the request */
  line: Beat;
  /** the beat whose words are on stage now: the request, or the reaction/rephrase that says it again */
  current: Beat;
  /** the words on stage: the request, or its rephrase */
  shown: RenderedLine;
  /** times the request was said again after a miss or a confused look */
  again: number;
  /** how the last repeat was said: slower (same words) or rephrased (other words) */
  repeat?: "slower" | "rephrase";
  /** their reaction to the last miss (a puzzled "yes?"), shown small */
  reaction?: Beat;
  /** the player's latest reply to the request */
  said?: Beat;
  /** replies that missed (said, then reacted to): faded and last among the slips */
  missed: Beat[];
  /** stage directions said with this exchange (before it, or with a miss) */
  direction: Beat[];
}

/** A history row: an utterance or a stage direction, with the exchange it came from (in this scene). */
export interface HistoryRow {
  beat: Beat;
  /** the index in `exchanges` it belongs to; undefined for rows before the scene */
  ex?: number;
}

export interface StageView {
  history: HistoryRow[];
  /** this scene's exchanges, oldest first; the last one is on stage */
  exchanges: Exchange[];
  /** stage directions with no exchange to belong to: a scene's opening before its first line, or what
   * was said between scenes (a scene's end, a place, a new day) */
  direction: Beat[];
}

const npcLine = (b: Beat) => !!b.line && !!b.speaker && b.speaker !== "player";
/** Stage directions kept on stage between scenes; older ones go to history. */
const LOOSE_DIRECTIONS = 2;

/**
 * Splits the transcript into history and stage. `from`: the first beat of the scene being played
 * (QuietView.stageFrom); left out between scenes, when the stage holds only the latest directions.
 */
export function stageView(backlog: readonly Beat[], from?: number): StageView {
  if (from === undefined) {
    // Between scenes: what was said since the last utterance or finished scene is on stage, the rest is history.
    let i = backlog.length;
    while (i > 0 && !backlog[i - 1].speaker && backlog[i - 1].tone !== "done" && backlog.length - i < LOOSE_DIRECTIONS) i--;
    return { history: backlog.slice(0, i).map((beat) => ({ beat })), exchanges: [], direction: backlog.slice(i) };
  }
  const at = backlog.findIndex((b) => b.id >= from);
  const before = at < 0 ? backlog : backlog.slice(0, at);
  const scene = at < 0 ? [] : backlog.slice(at);
  const exchanges: Exchange[] = [];
  let pending: Beat[] = [];
  for (const b of scene) {
    const cur = exchanges.at(-1);
    if (!npcLine(b) && b.speaker !== "player") {
      pending.push(b);
      continue;
    }
    if (b.speaker === "player") {
      if (cur) cur.said = b;
      continue;
    }
    // The request said again: after a miss (a reaction carrying it), or rephrased.
    const again = cur && (b.restate || b.rephrase);
    if (cur && again) {
      if (cur.said) cur.missed = [...cur.missed.filter((m) => !sameReply(m, cur.said!)), cur.said];
      cur.again++;
      cur.current = b;
      cur.reaction = b.restate ? b : undefined;
      const rephrase = b.restate?.rephrase ?? (b.rephrase ? (b.slow ? "slower" : "rephrase") : undefined);
      cur.repeat = rephrase ?? "slower";
      if (b.restate?.rephrase === "rephrase") cur.shown = b.restate.line;
      else if (b.rephrase && !b.slow && b.line) cur.shown = b.line;
      if (pending.length) cur.direction = pending;
      pending = [];
      continue;
    }
    exchanges.push({ line: b, current: b, shown: b.line!, again: 0, missed: [], direction: pending });
    pending = [];
  }
  // Directions after the last exchange's reply wait for the next line; with none to come they stay with it.
  if (pending.length) {
    const cur = exchanges.at(-1);
    if (cur) cur.direction = [...cur.direction, ...pending];
  }
  const history: HistoryRow[] = before.map((beat) => ({ beat }));
  exchanges.slice(0, -1).forEach((x, ex) => {
    for (const beat of x.direction) history.push({ beat, ex });
    history.push({ beat: x.line, ex });
    if (x.said && !x.missed.includes(x.said)) history.push({ beat: x.said, ex });
  });
  return { history, exchanges, direction: exchanges.length ? [] : pending };
}

/** Two of the player's replies say the same thing. */
export const sameReply = (a: Beat, b: Beat) => (a.line?.text ?? a.text) === (b.line?.text ?? b.text);

/**
 * The order reply slips are drawn in (indexes into `options`): replies already tried on this request go
 * last, so the stack says a different reply is needed. Number keys follow this order.
 */
export function replyOrder(options: readonly RenderedLine[], missed: readonly Beat[]): number[] {
  const tried = new Set(missed.map((m) => m.line?.text ?? m.text));
  const idx = options.map((_, i) => i);
  return [...idx.filter((i) => !tried.has(options[i].text)), ...idx.filter((i) => tried.has(options[i].text))];
}
