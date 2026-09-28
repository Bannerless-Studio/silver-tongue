// Forked from packages/vn-web/src/vn.ts so the two pages can evolve apart. Differences: beats are not
// tapped through (everything said lands in the transcript at once), money is not narrated line by
// line (a reply's cost rides on the reply; food is silent; wages are the scene's closing prose), trust
// is silent, the scene being played is exposed for the review tell, and any line can be revealed.
import { describeRun, joinTiles, wordState, type Core, type Course, type GameEvent, type GameState, type Input, type RenderedLine, type WordId } from "@silver-tongue/core";
import {
  actionNarration, introLines, makeText, placeMenu, sentenceCard, tileEcho, waitingForMoney, wordCard,
  type AudioOut, type MenuItem, type SentenceCard, type Speech, type Text, type WordCard,
} from "@silver-tongue/view";

export interface Beat {
  id: number;
  /** an NPC id, "player" for the player's own reply, absent for narration */
  speaker?: string;
  /** a line in the language being learned */
  line?: RenderedLine;
  /** narration or a mentor note, in the reading language */
  text?: string;
  /** a mentor note's title */
  title?: string;
  /** react: an NPC's reaction to a miss, and narration of what was asked instead. narr: stage direction
   * (the opening story, a scene's framing, what the player did, where a resumed game is, a new day).
   * good / warn / plain: outcomes (wages, money). */
  tone?: "plain" | "warn" | "good" | "react" | "narr";
  /** words new to the player when this line was said: heard for the first time, or never heard at all
   * (a reaction line is not counted as hearing), and not glossed yet in this transcript. The only words
   * that gloss themselves; each word glosses once per game session. */
  fresh?: WordId[];
  /** what the player's reply cost (a negative wallet change), shown on the reply; mixup when a miss cost it */
  cost?: { amount: number; reason: "mixup" | "shopping" };
  /** said again after two misses: shown with its reading and meaning */
  rephrase?: boolean;
  /** a reaction to a miss: the request, said again on the same line (no second clip). After a second
   * miss it is the rephrase (or the line said slower), shown with its reading and meaning. */
  restate?: Restate;
  /** a new day starts here */
  day?: number;
}
export interface Restate {
  line: RenderedLine;
  /** words new in a rephrase; none for the request said again (they were glossed when first said) */
  fresh?: WordId[];
  rephrase?: "rephrase" | "slower";
}
export type Phase =
  | { kind: "name" }
  /** confused: "..." is offered after the replies, until the line has been said again */
  | { kind: "pick"; options: RenderedLine[]; confused: boolean }
  | { kind: "tiles"; tiles: string[]; placed: number[]; answer: string }
  | { kind: "explore"; menu: MenuItem[]; waiting: string[] };
export interface Toast { id: number; text: string; tone: "good" | "bad" | "info" }
export interface QuietView {
  /** the scene being played, for the review tell */
  scene?: string;
  phase: Phase;
  /** the NPC line replies answer: what `?` reveals when no line is named */
  lastLine?: RenderedLine;
  backlog: Beat[];
  toasts: Toast[];
}
export interface QuietOptions {
  course: Course;
  core: Core;
  now: () => number;
  /** saves after each accepted input; false if it couldn't. Leave out to play without saving. */
  save?: (state: GameState) => boolean;
  audio?: AudioOut;
  /** a message id shown once at start, e.g. "notice-bad-save" */
  notice?: string;
}
export interface Quiet {
  readonly t: Text;
  readonly course: Course;
  readonly core: Core;
  view(): QuietView;
  subscribe(fn: () => void): () => void;
  choose(n: number): void;
  placeTile(i: number): void;
  undoTile(): void;
  sendTiles(): void;
  /** `surface`: the word as written in the line, when it is another form of the word */
  lookUp(word: WordId, surface?: string): WordCard;
  /** a line's reading and meaning; not logged as help. Defaults to the line replies answer. */
  sentence(line?: RenderedLine): SentenceCard | undefined;
  replay(slow?: boolean): void;
  play(clips: string[]): void;
  setName(name: string): boolean;
  /** whether an option's intent is shown under it */
  intentShown(options: RenderedLine[], o: RenderedLine): boolean;
  toggleSound(): void;
  dismissToast(id: number): void;
}

/** The newest line an NPC said: what `?` reveals. */
export function latestNpcLine(backlog: Beat[]): Beat | undefined {
  for (let i = backlog.length - 1; i >= 0; i--) {
    const b = backlog[i];
    if (b.line && b.speaker && b.speaker !== "player") return b;
  }
  return undefined;
}

export const BACKLOG_LIMIT = 300;
/** A menu or reply shown less than this long ago ignores taps: the second half of a double tap lands on the new screen. */
export const SETTLE_MS = 350;
const TOAST_LIMIT = 4;
/** What the player says when looking confused. */
export const CONFUSED = "...";

/**
 * The quiet terminal's side of play: turns core events into transcript lines and keys into inputs.
 * It keeps only what is on screen; the game itself is core.state.
 */
export function createQuiet(opts: QuietOptions): Quiet {
  const { course, core } = opts;
  const t = makeText(course.learnerFtl, course.learner);
  const npcName = (npc: string) => t(`npc-${npc}`);
  const money = (delta: number, reason: string) =>
    t("wallet-change", { sign: delta > 0 ? "+" : "-", amount: Math.abs(delta), currency: course.world.currency, reason: t(`reason-${reason}`) });

  let scene: string | undefined;
  let queue: Beat[] = [];
  let speeches: Speech[] = [];
  let reply: { mode: "pick"; options: RenderedLine[] } | { mode: "tiles"; tiles: string[] } | undefined;
  let placed: number[] = [];
  let lastLine: RenderedLine | undefined;
  let lastSpeech: Speech | undefined;
  let backlog: Beat[] = [];
  let toasts: Toast[] = [];
  let naming = course.needsName && !core.state.player;
  let resuming = false;
  let nextId = 1;
  /** news that arrived mid-scene, held until the scene is over so it never lands between a line and its replies */
  let held: Omit<Toast, "id">[] = [];
  /** words already glossed in this transcript: a word is boxed and glossed once, then rendered as usual */
  const glossed = new Set<WordId>();
  let save = opts.save;
  const listeners = new Set<() => void>();

  const changed = () => listeners.forEach((f) => f());
  const soundOn = () => !!opts.audio?.available && core.state.sound !== false;
  const say = (lines: Speech[]) => {
    if (lines.length && soundOn()) opts.audio!.play(lines);
  };
  const speech = (clips: string[] | undefined, slow = false): Speech | undefined =>
    clips?.length ? (slow ? { clips, slow } : { clips }) : undefined;
  const toast = (text: string, tone: Toast["tone"]) => {
    toasts = [...toasts, { id: nextId++, text, tone }].slice(-TOAST_LIMIT);
  };
  const news = (text: string, tone: Toast["tone"]) => {
    if (scene) held.push({ text, tone });
    else toast(text, tone);
  };
  const push = (b: Omit<Beat, "id">, s?: Speech): Beat => {
    const beat = { id: nextId++, ...b };
    queue.push(beat);
    if (s) speeches.push(s);
    return beat;
  };

  /** Moves everything said into the transcript and says it aloud, in order. */
  let shownAt = -Infinity;
  const settled = () => opts.now() - shownAt >= SETTLE_MS;
  /** `settle`: the screen changed (new replies or menu), so taps start counting again only after SETTLE_MS. */
  function flush(settle: boolean) {
    if (queue.length) backlog = [...backlog, ...queue].slice(-BACKLOG_LIMIT);
    queue = [];
    say(speeches);
    speeches = [];
    if (!scene && held.length) {
      for (const h of held) toast(h.text, h.tone);
      held = [];
    }
    if (settle) shownAt = opts.now();
  }

  function apply(events: GameEvent[]) {
    const fresh = new Set(events.flatMap((e) => (e.type === "wordStateChanged" && e.from === "unseen" ? [e.word] : [])));
    const now = opts.now();
    const freshIn = (l: RenderedLine) => {
      const out = [...new Set(l.tokens.map((tk) => tk.word).filter((w) => !glossed.has(w) && (fresh.has(w) || wordState(core.state.words[w], now) === "unseen")))];
      for (const w of out) glossed.add(w);
      return out;
    };
    let hinted = false;
    /** reactions that restate the request; only kept when the replies come back after them */
    const reacted: Beat[] = [];
    for (const e of events) {
      switch (e.type) {
        case "sceneStarted":
          scene = e.scene;
          reply = undefined;
          if (!resuming && t.has(`scene-${e.scene}-start`)) push({ text: t(`scene-${e.scene}-start`), tone: "narr" });
          break;
        case "lineSpoken":
          lastLine = e.line;
          lastSpeech = speech(e.line.audio);
          push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line) }, lastSpeech);
          break;
        case "lineRephrased": {
          lastLine = e.line;
          lastSpeech = speech(e.line.audio, e.slow);
          // Merged into the reaction just said: one NPC line, never the request twice.
          const r = reacted.at(-1);
          if (r && r.speaker === e.npc && queue.includes(r)) {
            r.restate = { line: e.line, fresh: e.slow ? [] : freshIn(e.line), rephrase: e.slow ? "slower" : "rephrase" };
            if (lastSpeech) speeches.push(lastSpeech);
          } else push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line), rephrase: true }, lastSpeech);
          break;
        }
        case "replyOptions":
          reply = e.mode === "pick" ? { mode: "pick", options: e.options } : { mode: "tiles", tiles: e.tiles };
          placed = [];
          break;
        case "actionPerformed": {
          const said = actionNarration(course, t, e, scene && npcName(course.scenes.find((s) => s.id === scene)?.npc ?? ""));
          // A miss is one narration line: what the player did and what was asked, together.
          if (!e.matched && said.length) push({ text: said.map((n) => n.text).join(" "), tone: "react" });
          else for (const n of said) push({ text: n.text, tone: n.tone === "warn" ? "react" : "narr" });
          break;
        }
        case "npcReacted": {
          // The reaction carries the request said again, so the next reply answers it, not the reaction.
          // Only its own clip plays; word help keeps offering the request the player got wrong.
          const r = push({ speaker: e.npc, line: e.line, fresh: freshIn(e.line), tone: "react" }, speech(course.reactionAudio?.[e.reaction]?.[e.npc]));
          if (lastLine) {
            r.restate = { line: lastLine };
            reacted.push(r);
          }
          break;
        }
        case "walletChanged": {
          // Food is expected every night and wages are the scene's closing line: neither is news.
          if (e.reason === "food" || e.reason === "wages") break;
          const reason = e.reason === "mixup" || e.reason === "shopping" ? e.reason : undefined;
          const echo = e.delta < 0 && reason ? [...queue].reverse().find((b) => b.speaker === "player") : undefined;
          if (echo && reason) echo.cost = { amount: (echo.cost?.amount ?? 0) + e.delta, reason: echo.cost?.reason === "mixup" ? "mixup" : reason };
          else push({ text: money(e.delta, e.reason), tone: e.delta < 0 ? "warn" : "good" });
          break;
        }
        case "sceneEnded":
          scene = undefined;
          reply = undefined;
          lastLine = undefined;
          lastSpeech = undefined;
          if (t.has(`scene-${e.scene}-end`)) push({ text: t(`scene-${e.scene}-end`), tone: "narr" });
          push({ text: t("scene-done", { currency: course.world.currency, earned: e.earned }), tone: e.earned > 0 ? "good" : "plain" });
          break;
        case "unlocked":
          news(t("unlocked", { scene: t(`scene-${e.scene}`) }), "good");
          break;
        case "placeRevealed":
          news(t("place-revealed", { count: 1, places: t(`place-${e.place}`) }), "good");
          break;
        case "errandStarted":
          news(t("errand-started"), "info");
          break;
        case "errandEnded":
          news(t("errand-ended"), "info");
          break;
        case "rankChanged":
          news(t("rank-up", { rank: t(`rank-${e.rank}`) }), "good");
          break;
        case "dayEnded":
          // core.state already holds the new day when events are applied
          push({ text: t(e.rough ? "day-ended-rough" : "day-ended", { day: e.day }), tone: "narr", day: core.state.day });
          break;
        case "inputRejected":
          toast(t(`reject-${e.reason}`), "bad");
          break;
        case "noteReady":
          // One hint however many notes became ready at once.
          if (course.world.mentor && !hinted) news(t("note-hint", { npc: npcName(course.world.mentor.npc) }), "info");
          hinted = true;
          break;
        case "mentorVisited":
          if (!e.notes.length) push({ speaker: e.npc, text: t("mentor-nothing", { npc: npcName(e.npc) }) });
          for (const id of e.notes) push({ speaker: e.npc, title: t(`note-${id}-title`), text: t(`note-${id}`) });
          break;
        case "placeEntered":
        case "trustChanged":
        case "wordStateChanged":
        case "playerNamed":
        case "soundSet":
          break;
      }
    }
    // No replies after the reaction (the scene ended): nothing to answer, so the request isn't said again.
    if (!events.some((e) => e.type === "replyOptions")) for (const r of reacted) if (!r.restate?.rephrase) delete r.restate;
  }

  /** Whether an option's intent is shown under it: only while the options' intents differ (one shared by
   * several tells nothing) or it is the only option, and the option holds a word not known yet. Once its
   * words are known the intent would only translate it, so it goes. */
  function intentShown(options: RenderedLine[], o: RenderedLine): boolean {
    if (!o.intent || (options.length > 1 && options.every((x) => x.intent === options[0].intent))) return false;
    const at = opts.now();
    return o.tokens.some((tk) => wordState(core.state.words[tk.word], at) !== "known");
  }

  function persist() {
    if (save && !save(core.state)) {
      save = undefined; // stop trying; say so once
      toast(t("notice-read-only"), "bad");
    }
  }

  /** Sends an input; the player's own line (echo) is shown first, and only if the input was taken. */
  function send(input: Input, echo?: Omit<Beat, "id">, echoSpeech?: Speech, settle = true): boolean {
    const events = core.send(input);
    const taken = !events.some((e) => e.type === "inputRejected");
    if (echo && taken) push(echo, echoSpeech);
    apply(events);
    if (taken) persist();
    flush(settle);
    changed();
    return taken;
  }

  function phase(): Phase {
    if (naming) return { kind: "name" };
    if (reply?.mode === "pick") return { kind: "pick", options: reply.options, confused: !!core.state.run && core.state.run.misses < 2 };
    if (reply?.mode === "tiles") return { kind: "tiles", tiles: reply.tiles, placed, answer: joinTiles(course, placed.map((i) => (reply as { tiles: string[] }).tiles[i])) };
    return { kind: "explore", menu: placeMenu(course, core.state, t), waiting: waitingForMoney(course, core.state, t) };
  }

  if (opts.notice) toast(t(opts.notice), "bad");
  const intro = introLines(course, core.state, t);
  for (const text of intro) push({ text, tone: "narr" });
  resuming = true;
  apply(describeRun(course, core.state)); // a save made mid-scene resumes in the scene: its line, then its replies
  resuming = false;
  // A game picked up between scenes: say where the player is, so the screen is never blank.
  if (!intro.length && !scene) push({ text: t("quiet-resume", { place: t(`place-${core.state.place}`) }), tone: "narr" });
  flush(true);

  return {
    t,
    course,
    core,
    view: () => ({ scene, phase: phase(), lastLine, backlog, toasts }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    choose(n) {
      if (!settled()) return;
      const p = phase();
      if (p.kind === "explore") {
        const item = p.menu[n];
        if (item) send(item.input);
      } else if (p.kind === "pick") {
        const o = p.options[n];
        if (o) send({ type: "reply", choice: n }, { speaker: "player", line: o }, speech(o.audio));
        else if (n === p.options.length && p.confused) send({ type: "confused" }, { speaker: "player", text: CONFUSED });
      }
    },
    placeTile(i) {
      if (reply?.mode !== "tiles" || i < 0 || i >= reply.tiles.length || placed.includes(i)) return;
      placed = [...placed, i];
      changed();
    },
    undoTile() {
      if (reply?.mode !== "tiles" || !placed.length) return;
      placed = placed.slice(0, -1);
      changed();
    },
    sendTiles() {
      if (reply?.mode !== "tiles" || !placed.length) return;
      const said = tileEcho(course, core.state, reply.tiles, placed);
      send({ type: "replyTiles", tiles: placed }, { speaker: "player", line: said.line }, said.right ? speech(said.clips) : undefined);
    },
    lookUp(word, surface) {
      const card = wordCard(course, word, surface);
      const s = speech(card.clips);
      if (s) say([s]);
      send({ type: "helpWord", word }, undefined, undefined, false); // the replies on screen stay as they are
      return card;
    },
    sentence(line) {
      // Reading the whole line is not logged as help: the words still have to be recognised.
      const l = line ?? lastLine;
      const card = l ? sentenceCard(course, l) : undefined;
      const s = speech(card?.clips);
      if (s) say([s]);
      return card;
    },
    replay(slow = false) {
      if (lastSpeech) say([slow || lastSpeech.slow ? { ...lastSpeech, slow: true } : lastSpeech]);
    },
    play(clips) {
      const s = speech(clips);
      if (s) say([s]);
    },
    intentShown,
    setName(name) {
      if (!naming) return true;
      const events = core.send({ type: "setName", name });
      if (events.some((e) => e.type === "inputRejected")) {
        toast(t("reject-bad-name"), "bad");
        changed();
        return false;
      }
      persist();
      naming = false;
      changed();
      return true;
    },
    toggleSound() {
      if (!opts.audio?.available) return;
      const on = core.state.sound === false;
      if (!on) opts.audio.stop();
      send({ type: "setSound", on }, undefined, undefined, false);
    },
    dismissToast(id) {
      toasts = toasts.filter((x) => x.id !== id);
      changed();
    },
  };
}
