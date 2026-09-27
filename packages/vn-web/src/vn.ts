import { describeRun, joinTiles, type Core, type Course, type GameEvent, type GameState, type Input, type RenderedLine, type WordId } from "@silver-tongue/core";
import {
  actionNarration, introLines, makeText, placeMenu, sentenceCard, tileEcho, waitingForMoney, wordCard,
  type AudioOut, type MenuItem, type SentenceCard, type Speech, type Text, type WordCard,
} from "@silver-tongue/view";

export type Cue = "speak" | "puzzled" | "pleased" | "listen";
export interface Beat {
  /** an NPC id, "player" for the player's own reply, absent for narration */
  speaker?: string;
  /** a line in the language being learned */
  line?: RenderedLine;
  /** narration or a mentor note, in the reading language */
  text?: string;
  /** a mentor note's title */
  title?: string;
  tone?: "plain" | "warn" | "good";
  /** words heard for the first time in this line */
  fresh?: WordId[];
  speech?: Speech;
  cue?: Cue;
  /** a new day starts: the page shows "Day N" over black while this beat is up */
  day?: number;
}
export type Phase =
  | { kind: "name" }
  | { kind: "beat"; beat: Beat }
  | { kind: "pick"; options: RenderedLine[] }
  | { kind: "tiles"; tiles: string[]; placed: number[]; answer: string }
  | { kind: "explore"; menu: MenuItem[]; waiting: string[] };
export interface Toast { id: number; text: string; tone: "good" | "bad" | "info" }
export interface VnView {
  place: string;
  /** who stands centre stage (in a scene or a mentor visit) */
  npc?: string;
  cue: Cue;
  phase: Phase;
  /** the NPC line replies answer, for word help and the meaning card */
  lastLine?: RenderedLine;
  backlog: Beat[];
  toasts: Toast[];
  /** wallet changes, newest last; each id rises once */
  floats: { id: number; delta: number }[];
}
export interface VnOptions {
  course: Course;
  core: Core;
  now: () => number;
  /** saves after each accepted input; false if it couldn't. Leave out to play without saving. */
  save?: (state: GameState) => boolean;
  audio?: AudioOut;
  /** a message id shown once at start, e.g. "notice-bad-save" */
  notice?: string;
}
export interface Vn {
  readonly t: Text;
  readonly course: Course;
  readonly core: Core;
  view(): VnView;
  subscribe(fn: () => void): () => void;
  advance(): void;
  choose(n: number): void;
  talkTo(npc: string): void;
  placeTile(i: number): void;
  undoTile(): void;
  sendTiles(): void;
  lookUp(word: WordId): WordCard;
  sentence(): SentenceCard | undefined;
  replay(slow?: boolean): void;
  play(clips: string[]): void;
  setName(name: string): boolean;
  toggleSound(): void;
  dismissToast(id: number): void;
}

export const BACKLOG_LIMIT = 200;
/** A menu or reply shown less than this long ago ignores taps: the second half of a double tap lands on the new screen. */
export const SETTLE_MS = 350;
const TOAST_LIMIT = 4;

/**
 * The visual novel's side of play: turns core events into beats the player taps through, and taps
 * into inputs. It keeps only what is on screen; the game itself is core.state.
 */
export function createVn(opts: VnOptions): Vn {
  const { course, core } = opts;
  const t = makeText(course.learnerFtl, course.learner);
  const npcName = (npc: string) => t(`npc-${npc}`);

  let place = core.state.place;
  let npc: string | undefined;
  let cue: Cue = "listen";
  let queue: Beat[] = [];
  let current: Beat | undefined;
  let reply: { mode: "pick"; options: RenderedLine[] } | { mode: "tiles"; tiles: string[] } | undefined;
  let placed: number[] = [];
  let lastLine: RenderedLine | undefined;
  let backlog: Beat[] = [];
  let toasts: Toast[] = [];
  let floats: { id: number; delta: number }[] = [];
  let naming = course.needsName && !core.state.player;
  let leaving = false; // the scene or visit is over: the NPC leaves once its last beat is read
  let resuming = false;
  let nextId = 1;
  let save = opts.save;
  const listeners = new Set<() => void>();

  const changed = () => listeners.forEach((f) => f());
  const soundOn = () => !!opts.audio?.available && core.state.sound !== false;
  const say = (speech?: Speech) => {
    if (speech?.clips.length && soundOn()) opts.audio!.play([speech]);
  };
  const speech = (clips: string[] | undefined, slow = false): Speech | undefined =>
    clips?.length ? (slow ? { clips, slow } : { clips }) : undefined;
  const toast = (text: string, tone: Toast["tone"]) => {
    toasts = [...toasts, { id: nextId++, text, tone }].slice(-TOAST_LIMIT);
  };
  const log = (b: Beat) => {
    backlog = [...backlog, b].slice(-BACKLOG_LIMIT);
  };

  /** Shows the next beat, or, when there is none, lets the NPC leave or listen. */
  let shownAt = -Infinity;
  const settled = () => opts.now() - shownAt >= SETTLE_MS;

  function show() {
    current = queue.shift();
    if (current) {
      log(current);
      if (current.cue) cue = current.cue;
      say(current.speech);
      return;
    }
    if (leaving) {
      npc = undefined;
      leaving = false;
    }
    if (reply) cue = "listen";
    shownAt = opts.now();
  }

  function apply(events: GameEvent[]) {
    const fresh = new Set(events.flatMap((e) => (e.type === "wordStateChanged" && e.from === "unseen" ? [e.word] : [])));
    const freshIn = (l: RenderedLine) => l.tokens.map((tk) => tk.word).filter((w) => fresh.has(w));
    let hinted = false;
    for (const e of events) {
      switch (e.type) {
        case "placeEntered":
          place = e.place;
          npc = undefined;
          break;
        case "sceneStarted":
          npc = e.npc;
          leaving = false;
          reply = undefined;
          if (!resuming && t.has(`scene-${e.scene}-start`)) queue.push({ text: t(`scene-${e.scene}-start`), cue: "listen" });
          break;
        case "lineSpoken":
          lastLine = e.line;
          queue.push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line), speech: speech(e.line.audio), cue: "speak" });
          break;
        case "lineRephrased":
          lastLine = e.line;
          queue.push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line), speech: speech(e.line.audio, e.slow), cue: "speak" });
          break;
        case "replyOptions":
          reply = e.mode === "pick" ? { mode: "pick", options: e.options } : { mode: "tiles", tiles: e.tiles };
          placed = [];
          break;
        case "actionPerformed":
          for (const n of actionNarration(course, t, e, npc && npcName(npc))) queue.push({ text: n.text, tone: n.tone, cue: e.matched ? "pleased" : "puzzled" });
          break;
        case "npcReacted":
          // Word help keeps offering the request the player got wrong, not the reaction.
          queue.push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line), speech: speech(course.reactionAudio?.[e.reaction]?.[e.npc]), cue: "puzzled" });
          break;
        case "walletChanged":
          floats = [...floats, { id: nextId++, delta: e.delta }].slice(-TOAST_LIMIT);
          log({
            text: t("wallet-change", { sign: e.delta > 0 ? "+" : "-", amount: Math.abs(e.delta), currency: course.world.currency, reason: t(`reason-${e.reason}`) }),
            tone: e.delta > 0 ? "good" : "warn",
          });
          break;
        case "trustChanged":
          toast(t("trust-up", { npc: npcName(e.npc), trust: e.trust }), "good");
          break;
        case "sceneEnded":
          leaving = true;
          reply = undefined;
          lastLine = undefined;
          if (t.has(`scene-${e.scene}-end`)) queue.push({ text: t(`scene-${e.scene}-end`), cue: "pleased" });
          queue.push({ text: t("scene-done", { currency: course.world.currency, earned: e.earned }), tone: "good", cue: "pleased" });
          break;
        case "unlocked":
          toast(t("unlocked", { scene: t(`scene-${e.scene}`) }), "good");
          break;
        case "errandStarted":
          toast(t("errand-started"), "info");
          break;
        case "errandEnded":
          toast(t("errand-ended"), "info");
          break;
        case "rankChanged":
          toast(t("rank-up", { rank: t(`rank-${e.rank}`) }), "good");
          break;
        case "dayEnded":
          // core.state already holds the new day when events are applied
          queue.push({ text: t(e.rough ? "day-ended-rough" : "day-ended", { day: e.day }), day: core.state.day });
          break;
        case "inputRejected":
          toast(t(`reject-${e.reason}`), "bad");
          break;
        case "noteReady":
          // One hint however many notes became ready at once.
          if (course.world.mentor && !hinted) toast(t("note-hint", { npc: npcName(course.world.mentor.npc) }), "info");
          hinted = true;
          break;
        case "mentorVisited":
          npc = e.npc;
          leaving = true;
          if (!e.notes.length) queue.push({ speaker: e.npc, text: t("mentor-nothing", { npc: npcName(e.npc) }), cue: "listen" });
          for (const id of e.notes) queue.push({ speaker: e.npc, title: t(`note-${id}-title`), text: t(`note-${id}`), cue: "speak" });
          break;
        case "wordStateChanged":
        case "playerNamed":
        case "soundSet":
          break;
      }
    }
  }

  function persist() {
    if (save && !save(core.state)) {
      save = undefined; // stop trying; say so once
      toast(t("notice-read-only"), "bad");
    }
  }

  /** Sends an input; the player's own line (echo) is shown first, and only if the input was taken. */
  function send(input: Input, echo?: Beat): boolean {
    const events = core.send(input);
    const taken = !events.some((e) => e.type === "inputRejected");
    if (echo && taken) queue.push(echo);
    apply(events);
    if (taken) persist();
    if (!current) show();
    changed();
    return taken;
  }

  function phase(): Phase {
    if (naming) return { kind: "name" };
    if (current) return { kind: "beat", beat: current };
    if (reply?.mode === "pick") return { kind: "pick", options: reply.options };
    if (reply?.mode === "tiles") return { kind: "tiles", tiles: reply.tiles, placed, answer: joinTiles(course, placed.map((i) => (reply as { tiles: string[] }).tiles[i])) };
    return { kind: "explore", menu: placeMenu(course, core.state, t), waiting: waitingForMoney(course, core.state, t) };
  }

  if (opts.notice) toast(t(opts.notice), "bad");
  for (const text of introLines(course, core.state, t)) queue.push({ text });
  resuming = true;
  apply(describeRun(course, core.state)); // a save made mid-scene resumes in the scene
  resuming = false;
  show();

  return {
    t,
    course,
    core,
    view: () => ({ place, npc, cue, phase: phase(), lastLine, backlog, toasts, floats }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    advance() {
      if (!current || naming) return;
      show();
      changed();
    },
    choose(n) {
      if (!settled()) return;
      const p = phase();
      if (p.kind === "explore") {
        const item = p.menu[n];
        if (item) send(item.input);
      } else if (p.kind === "pick") {
        const o = p.options[n];
        if (o) send({ type: "reply", choice: n }, { speaker: "player", line: o, speech: speech(o.audio), cue: "listen" });
      }
    },
    talkTo(who) {
      const p = phase();
      if (p.kind !== "explore" || !settled()) return;
      const item = p.menu.find((m) => (m.kind === "talk" || m.kind === "mentor") && m.npc === who);
      if (item) send(item.input);
    },
    placeTile(i) {
      if (reply?.mode !== "tiles" || current || i < 0 || i >= reply.tiles.length || placed.includes(i)) return;
      placed = [...placed, i];
      changed();
    },
    undoTile() {
      if (reply?.mode !== "tiles" || current || !placed.length) return;
      placed = placed.slice(0, -1);
      changed();
    },
    sendTiles() {
      if (reply?.mode !== "tiles" || current || !placed.length) return;
      const said = tileEcho(course, core.state, reply.tiles, placed);
      send({ type: "replyTiles", tiles: placed }, { speaker: "player", line: said.line, speech: said.right ? speech(said.clips) : undefined, cue: "listen" });
    },
    lookUp(word) {
      const card = wordCard(course, word);
      say(speech(card.clips));
      send({ type: "helpWord", word });
      return card;
    },
    sentence() {
      // Reading the whole line is not logged as help: the words still have to be recognised.
      const card = lastLine && sentenceCard(course, lastLine);
      if (card) say(speech(card.clips));
      return card;
    },
    replay(slow = false) {
      const s = current?.speech ?? speech(lastLine?.audio);
      if (s) say(slow || s.slow ? { ...s, slow: true } : s);
    },
    play(clips) {
      say(speech(clips));
    },
    setName(name) {
      const events = core.send({ type: "setName", name });
      if (events.some((e) => e.type === "inputRejected")) {
        toast(t("reject-bad-name"), "bad");
        changed();
        return false;
      }
      persist();
      naming = false;
      if (!current) show();
      changed();
      return true;
    },
    toggleSound() {
      if (!opts.audio?.available) return;
      const on = core.state.sound === false;
      if (!on) opts.audio.stop();
      send({ type: "setSound", on });
    },
    dismissToast(id) {
      toasts = toasts.filter((x) => x.id !== id);
      changed();
    },
  };
}
