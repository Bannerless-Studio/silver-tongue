import {
  describeRun,
  joinTiles,
  MAX_NAME_LENGTH,
  wordState,
  type CatalogEntry,
  type Core,
  type Course,
  type GameEvent,
  type GameState,
  type Input,
  type RenderedLine,
  type WordId,
} from "@silver-tongue/core";
import type { AudioOut, Speech, SpeechSpeed } from "@silver-tongue/view";
import { notebookBody, notebookGroups, notebookHead, type NotebookView } from "./notebook";
import { lineSpans, wrapItems } from "./screen";
import { innerWidth, NARROW, renderFrame, type Panel } from "./panel";
import { strWidth, wrapLine } from "./width";
import type { Key, StyledLine, Terminal } from "./terminal";
import {
  actionNarration, firstTimeGloss, hudValues, introLines, makeText, notebookEntries, placeMenu, readingRow, sentenceCard, settingsRows, tileEcho, waitingForMoney, wordCard,
  type HudValues, type SettingsScreen, type Text,
} from "@silver-tongue/view";

/** slow -> normal -> fast -> slow, as the settings screen's Speed row cycles. */
const SPEED_CYCLE: SpeechSpeed[] = ["slow", "normal", "fast"];

export interface AppOptions {
  course: Course;
  core: Core;
  term: Terminal;
  now: () => number;
  /** Saves after each accepted input; returns false if it couldn't. Leave out to play without saving. */
  save?: (state: GameState) => boolean;
  quit: () => void;
  /** a message id shown once at start, e.g. "notice-bad-save" */
  notice?: string;
  /** the game's version, shown in the bottom border ("Silver Tongue v0.5.0") */
  version?: string;
  /** sound out; without it the game is silent and says "no audio" */
  audio?: AudioOut;
  /** How fast clips are said, and how to remember a change; without it speed is fixed at "slow". */
  speed?: {
    value: SpeechSpeed;
    onChange(speed: SpeechSpeed): void;
  };
  /** Switching course and reading language from [o]; without it there is no [o]. */
  settings?: {
    /** the catalog; the course and reading language being played are course.id and course.learner */
    courses: CatalogEntry[];
    /**
     * The player chose another course or reading language: the app has saved (if it can) and hands
     * over the game as played, for a reading-language switch to go on with even when saving failed.
     */
    switchTo(course: string, learner: string, state: GameState): void;
  };
}

type MenuItem = { label: string; input?: Input; quit?: true; disabled?: string };
type Mode = "explore" | "scene" | "help" | "notebook" | "name" | "settings" | "settings-course" | "settings-reading";
const SETTINGS_MODES: Mode[] = ["settings", "settings-course", "settings-reading"];

export interface App {
  press(key: Key): void;
  render(): void;
}

const LOG_LIMIT = 200;

export function startApp(opts: AppOptions): App {
  const { course, core, term } = opts;
  const t: Text = makeText(course.learnerFtl, course.learner);

  let mode: Mode = "explore";
  let log: StyledLine[] = [];
  let pickOptions: RenderedLine[] = [];
  let tiles: string[] = [];
  let replyMode: "pick" | "tiles" = "pick";
  let tileInput: number[] = [];
  let lastLine: RenderedLine | null = null;
  let notebookFrom: Mode = "explore"; // where closing the notebook returns to
  let nbView: NotebookView = { tab: "words", group: 0, word: 0, open: false, top: 0 };
  let settingsFrom: Mode = "explore"; // where closing settings returns to
  let handedOver = false; // another course or reading language took over: this app is done
  let resuming = false;
  let nameInput = ""; // replaying a scene saved half-way: it has already been introduced
  let lastSlow = false; // the last line was a slow repeat, so r says it slowly too
  let lastHelp: string[] = []; // the clips of the word or sentence last looked up, for p
  let card: StyledLine[] | null = null; // the word or sentence last looked up, shown above the replies
  let tileReply: string[] = []; // the right reply's clips, said if the tiles match
  let queue: Speech[] = []; // what this key press has people say, in order
  let speed: SpeechSpeed = opts.speed?.value ?? "slow";
  let currentNpc: string | undefined; // the scene's NPC, for hints that name who asked
  let pendingNotes = new Set<string>(); // notes ready while a scene ran, shown once explore mode is back
  // Shown once per batch of ready-unread notes: set the moment the hint is shown, cleared only when
  // the mentor explains them all (pendingNotes goes back to empty). Without this, every scene that
  // readies another note (on top of ones the player already hasn't visited the mentor for) would
  // show the hint again.
  let noteHintShown = false;
  let visitedPlaces = new Set<string>(); // places whose name+description have already logged this session
  let lastRejectReason: string | undefined; // the previous log line's reject reason, to collapse a repeat

  const soundOn = () => !!opts.audio?.available && core.state.sound !== false;
  const hear = (clips: string[] | undefined, slow = false) => {
    if (clips?.length) queue.push(slow ? { clips, slow } : { clips });
  };
  /** Says everything this key press queued, unless sound is off. */
  const flush = () => {
    if (queue.length && soundOn()) opts.audio!.play(queue);
    queue = [];
  };

  const push = (...lines: StyledLine[]) => {
    log = [...log, ...lines].slice(-LOG_LIMIT);
  };
  const npcName = (npc: string) => t(`npc-${npc}`);
  const say = (npc: string, line: RenderedLine, fresh: Set<WordId>, suffix = ""): StyledLine => [
    { text: `${npcName(npc)}${suffix}: `, color: "cyan", bold: true },
    ...lineSpans(line, fresh),
  ];
  /** An NPC's line, then its reading while any word in it isn't known yet, lined up under the words. */
  const sayLine = (npc: string, line: RenderedLine, fresh: Set<WordId>, suffix = "") => {
    push(say(npc, line, fresh, suffix));
    const reading = readingRow(course, core.state, line, opts.now());
    if (reading) push([{ text: " ".repeat(strWidth(`${npcName(npc)}${suffix}: `)) + reading, color: "yellow", dim: true }]);
  };

  /** The number keys that choose among `n` items: "1", "1-4". */
  const keyRange = (n: number) => (n <= 1 ? "1" : `1-${Math.min(n, 9)}`);
  // The player's replies to the current request: the first, and the latest. Once one is right, the
  // wrong tries between them (and what they brought: hints, the slow repeat) have done their job.
  let firstTry: StyledLine | null = null;
  let lastTry: StyledLine | null = null;
  const echo = (text: string) => {
    lastTry = [{ text: `${t("you")}: `, color: "green", bold: true }, { text }];
    firstTry ??= lastTry;
    push(lastTry);
  };
  /** Drops the wrong tries before the right one, leaving the request and its answer. */
  const dropWrongTries = () => {
    const from = firstTry ? log.indexOf(firstTry) : -1;
    const to = lastTry ? log.indexOf(lastTry) : -1;
    if (from >= 0 && to > from) log = [...log.slice(0, from), ...log.slice(to)];
    firstTry = lastTry = null;
  };
  // Each hint once per request: a second miss repeating it says nothing new.
  let hintsShown = new Set<string>();

  /** Optional narration: shown when the learner text has it. */
  const narrate = (id: string, args?: Record<string, string | number>) => {
    if (t.has(id)) push([{ text: t(id, args), dim: true }]);
  };

  /**
   * The opening story (intro-1, intro-2, …) for a game that hasn't started yet, then the game's name
   * and its studio: after the story, so they are on the first screen however long the story is.
   */
  function tellIntro() {
    const story = introLines(course, core.state, t);
    if (!story.length) return;
    for (const line of story) push([{ text: line }], []);
    push([{ text: "Silver Tongue", bold: true, color: "cyan" }], [{ text: t("credit"), dim: true }]);
  }

  /**
   * What the reply did and, on a mix-up, what was asked (see actionNarration).
   */
  function narrateAction(action: Record<string, string>, expected: Record<string, string>, matched: boolean, tilesWrong: boolean) {
    for (const n of actionNarration(course, t, { action, expected, matched, tilesWrong }, currentNpc && npcName(currentNpc))) {
      if (n.tone === "warn") {
        if (hintsShown.has(n.text)) continue;
        hintsShown.add(n.text);
      }
      push([n.tone === "warn" ? { text: n.text, color: "yellow" } : { text: n.text, dim: true }]);
    }
  }

  function enterPlace(place: string) {
    // The frame's title names the current place; its description is worth a log entry only the
    // first time this place is seen this session.
    if (visitedPlaces.has(place)) return;
    visitedPlaces.add(place);
    push([], [{ text: t(`place-${place}-desc`), dim: true }]);
  }

  function apply(events: GameEvent[]) {
    const fresh = new Set(
      events.flatMap((e) => (e.type === "wordStateChanged" && e.from === "unseen" ? [e.word] : [])),
    );
    // A scene's own wages line already says it earned; "Done." only for the (normally unreachable)
    // case where it paid but no wallet line showed it.
    const hasWagesLine = events.some((ev) => ev.type === "walletChanged" && ev.reason === "wages");
    // A trust bump is only news when it unlocked something; otherwise it's noise every scene.
    const anyUnlocked = events.some((ev) => ev.type === "unlocked");
    const unlockedCount = events.filter((ev) => ev.type === "unlocked").length;
    // A scene unlocked somewhere other than here names that place too, so it's clear where to go.
    const unlockedLabel = (sceneId: string) => {
      const name = t(`scene-${sceneId}`);
      const place = course.scenes.find((s) => s.id === sceneId)?.place;
      return place && place !== core.state.place ? `${name} · ${t(`place-${place}`)}` : name;
    };
    const unlockedNames = events
      .filter((ev): ev is Extract<GameEvent, { type: "unlocked" }> => ev.type === "unlocked")
      .map((ev) => unlockedLabel(ev.scene));
    let unlockedShown = false;
    // Places revealed together share one line: news, but one piece of it. A place a "New:" scene
    // line already named is left out: that line said it.
    const namedByScene = new Set(
      events.flatMap((ev) => (ev.type === "unlocked" ? (course.scenes.find((s) => s.id === ev.scene)?.place ?? []) : [])).filter((p) => p !== core.state.place),
    );
    const revealed = events.flatMap((ev) => (ev.type === "placeRevealed" && !namedByScene.has(ev.place) ? [t(`place-${ev.place}`)] : []));
    let revealedShown = false;
    // A rejection is only worth a fresh log line the first time; a repeat of the same one replaces it.
    if (!events.some((ev) => ev.type === "inputRejected")) lastRejectReason = undefined;
    for (const e of events) {
      switch (e.type) {
        case "placeEntered":
          // What happened at the last place was read there; a new place starts a clean screen.
          log = [];
          enterPlace(e.place);
          break;
        case "sceneStarted":
          mode = "scene";
          currentNpc = e.npc;
          card = null;
          // The intro and place description above would otherwise bury every screen of the
          // conversation; the frame's title still says where we are. Resuming mid-scene at startup
          // is the exception: the place description was just pushed above and is worth keeping.
          if (!resuming) log = [];
          push([]);
          // A repeatable scene played before has already told its story; the second run is only news.
          if (!resuming && !(core.state.scenesDone[e.scene] ?? 0)) narrate(`scene-${e.scene}-start`);
          break;
        case "lineSpoken": {
          // A new request: the last one was answered.
          firstTry = lastTry = null;
          hintsShown = new Set();
          lastLine = e.line;
          lastSlow = false;
          hear(e.line.audio);
          sayLine(e.npc, e.line, fresh);
          const gloss = firstTimeGloss(course, e.line, fresh);
          if (gloss) push([{ text: `   ${gloss}`, dim: true }]);
          break;
        }
        case "replyOptions":
          replyMode = e.mode;
          tileInput = [];
          if (e.mode === "pick") pickOptions = e.options;
          else tiles = e.tiles;
          break;
        case "actionPerformed":
          if (replyMode === "tiles" && !e.tilesWrong) hear(tileReply);
          if (e.matched && !e.tilesWrong) dropWrongTries();
          narrateAction(e.action, e.expected, e.matched, e.tilesWrong);
          break;
        case "npcReacted":
          // Word help keeps offering the request the player got wrong, not the reaction.
          hear(course.reactionAudio?.[e.reaction]?.[e.npc]);
          sayLine(e.npc, e.line, fresh);
          break;
        case "lineRephrased":
          lastLine = e.line;
          lastSlow = e.slow;
          hear(e.line.audio, e.slow);
          sayLine(e.npc, e.line, fresh, ` ${t("rephrased")}`);
          // Two misses: nobody should get stuck, so the NPC also mimes it and its meaning is given.
          narrate("gesture-narration", { npc: npcName(e.npc) });
          if (e.line.meaning) push([{ text: e.line.meaning, dim: true }]);
          break;
        case "walletChanged":
          push([
            {
              text: t("wallet-change", {
                sign: e.delta > 0 ? "+" : "-",
                amount: Math.abs(e.delta),
                currency: course.world.currency,
                reason: t(`reason-${e.reason}`),
              }),
              color: e.delta > 0 ? "green" : "red",
            },
          ]);
          break;
        case "trustChanged":
          if (anyUnlocked) push([{ text: t("trust-up", { npc: npcName(e.npc) }), color: "magenta" }]);
          break;
        case "sceneEnded":
          mode = "explore";
          lastLine = null; // r repeats a line only while its scene is on
          card = null;
          // A repeatable scene's ending was already told the first time it played.
          if ((core.state.scenesDone[e.scene] ?? 0) <= 1) narrate(`scene-${e.scene}-end`);
          // A paid scene already said so via its wallet line; an unpaid one has nothing to add.
          if (e.earned > 0 && !hasWagesLine) push([{ text: t("scene-done-short"), bold: true }]);
          break;
        case "unlocked":
          if (unlockedCount >= 3) {
            if (!unlockedShown) {
              unlockedShown = true;
              // Scenes are joined with ", " so a "scene · place" label's own " · " separator stays
              // unambiguous even when the batch spans several places.
              push([{ text: t("unlocked-many", { scenes: unlockedNames.join(", ") }), color: "green" }]);
            }
          } else {
            push([{ text: t("unlocked", { scene: unlockedLabel(e.scene) }), color: "green" }]);
          }
          break;
        case "placeRevealed":
          if (!revealedShown && revealed.length) {
            revealedShown = true;
            push([{ text: t("place-revealed", { count: revealed.length, places: revealed.join(", ") }), color: "green" }]);
          }
          break;
        case "errandStarted":
          // The header's own "· parcel" marker already says this; a log line would be the third
          // time this scene told the player (after the scene's own narration).
          break;
        case "errandEnded":
          push([{ text: t("errand-ended"), color: "cyan" }]);
          break;
        case "rankChanged":
          push([{ text: t("rank-up", { rank: t(`rank-${e.rank}`) }), color: "yellow", bold: true }]);
          break;
        case "dayEnded":
          push([], [{ text: t(e.rough ? "day-ended-rough" : "day-ended", { day: e.day }), dim: true }]);
          break;
        case "inputRejected":
          // The same rejection repeated (e.g. talking twice with no time left) replaces
          // the previous line instead of piling up copies of it.
          if (lastRejectReason === e.reason) log = log.slice(0, -1);
          lastRejectReason = e.reason;
          push([{ text: t(`reject-${e.reason}`), color: "red" }]);
          break;
        case "noteReady":
          // Never mid-scene: buffered and shown once explore mode is back (see below).
          pendingNotes.add(e.note);
          break;
        case "mentorVisited":
          push([]);
          if (!e.notes.length) push([{ text: t("mentor-nothing", { npc: npcName(e.npc) }), dim: true }]);
          for (const id of e.notes) push([{ text: t(`note-${id}-title`), bold: true }], [{ text: t(`note-${id}`) }], []);
          for (const id of e.notes) pendingNotes.delete(id);
          if (!pendingNotes.size) noteHintShown = false;
          break;
        case "wordStateChanged":
          break;
      }
    }
    // A note readied mid-scene surfaces once we're back in explore mode, not mid-conversation, and
    // only the first time: a player who hasn't visited the mentor yet sees this once, not again for
    // every further scene that readies another note on top of the ones already waiting.
    if (mode === "explore" && pendingNotes.size && !noteHintShown && course.world.mentor) {
      push([{ text: t("note-hint", { npc: npcName(course.world.mentor.npc) }), color: "magenta" }]);
      noteHintShown = true;
    }
  }

  let save = opts.save;
  function persist() {
    if (save && !save(core.state)) {
      save = undefined; // stop trying; say so once
      push([{ text: t("notice-read-only"), color: "yellow" }]);
    }
  }

  function send(input: Input) {
    const events = core.send(input);
    apply(events);
    flush();
    if (!events.some((e) => e.type === "inputRejected")) persist();
  }

  /** Keys that work wherever a line or word can be heard: r says the last line again, m turns sound on or off. */
  function soundKey(name: string): boolean {
    if (name === "m") {
      if (!opts.audio?.available) return true; // nothing to turn on or off here
      const on = core.state.sound === false;
      if (!on) opts.audio?.stop();
      send({ type: "setSound", on });
      return true;
    }
    if (name === "r") {
      hear(lastLine?.audio, lastSlow);
      flush();
      return true;
    }
    return false;
  }

  const settingsScreen = (): SettingsScreen => (mode === "settings-course" ? "course" : mode === "settings-reading" ? "reading" : "main");
  /** The rows the settings screen shows, and what choosing each one does. */
  function settingsChoices(): { label: string; choose: () => void }[] {
    const ctx = {
      course,
      catalog: opts.settings!.courses,
      state: core.state,
      t,
      audioAvailable: !!opts.audio?.available,
      ...(opts.speed ? { terminal: { speed } } : {}),
    };
    return settingsRows(settingsScreen(), ctx).map((r) => ({
      label: r.label,
      choose: () => {
        const a = r.action;
        if (a.kind === "open") mode = a.screen === "course" ? "settings-course" : "settings-reading";
        else if (a.kind === "back") mode = "settings";
        else if (a.kind === "switch") switchTo(a.course, a.learner);
        else if (a.kind === "speed") {
          speed = SPEED_CYCLE[(SPEED_CYCLE.indexOf(speed) + 1) % SPEED_CYCLE.length];
          opts.speed?.onChange(speed);
        } else soundKey("m");
      },
    }));
  }

  /** Saves, stops any sound, and hands over to the front end, which starts the app again. */
  function switchTo(courseId: string, learner: string) {
    opts.audio?.stop();
    persist();
    handedOver = true;
    opts.settings!.switchTo(courseId, learner, core.state);
  }

  function menu(): MenuItem[] {
    // Sleep and quit always keep their keys; the content checker keeps places within 7 other items.
    return [...placeMenu(course, core.state, t), { label: t("menu-quit"), quit: true }];
  }

  /** Whether a reply's meaning is still news: at least one of its words isn't known yet. */
  function replyNeedsGloss(o: RenderedLine): boolean {
    return o.tokens.some((tk) => wordState(core.state.words[tk.word], opts.now()) !== "known");
  }

  /**
   * Words to look up: those of the last line, then (when picking a reply) the other words in the
   * replies, so a reply the player has never heard can be worked out. At most 9, one per number key.
   */
  function helpWords(): { text: string; word: WordId; inReplies: boolean }[] {
    if (!lastLine) return [];
    const pieces = (l: RenderedLine) => l.tokens.map((tk) => ({ text: l.text.slice(tk.start, tk.end), word: tk.word }));
    const said = pieces(lastLine).map((p) => ({ ...p, inReplies: false }));
    // A word's other spelling (a conjugation) is its own entry: it has its own reading.
    const key = (p: { text: string; word: WordId }) => `${p.word}\u0000${p.text}`;
    const seen = new Set(said.map(key));
    const replies = replyMode === "pick" ? pickOptions.flatMap(pieces) : [];
    const extra = replies.filter((p) => !seen.has(key(p)) && seen.add(key(p))).map((p) => ({ ...p, inReplies: true }));
    return [...said, ...extra].slice(0, 9);
  }

  /** The panel at the bottom: what the player can do now. `width` is the room inside the frame. */
  function replyPanel(width: number): Panel {
    if (mode === "name") {
      return { lines: [[{ text: t("name-prompt"), bold: true }], [{ text: "> " }, { text: nameInput, bold: true }, { text: "_", dim: true }]] };
    }
    if (SETTINGS_MODES.includes(mode)) {
      const title = mode === "settings" ? "settings-title" : mode === "settings-course" ? "settings-pick-course" : "settings-pick-reading";
      return { title: t(title), lines: settingsChoices().map((r, i) => [{ text: `${i + 1}) ${r.label}` }]) };
    }
    if (mode === "explore") {
      // Scenes here that wait only for money: shown, not offered, so an empty shop says why.
      const waiting: StyledLine[] = waitingForMoney(course, core.state, t).map((text) => [{ text, dim: true }]);
      return {
        title: t("menu-title"),
        lines: [
          ...waiting,
          ...menu().map((m, i) => [
            m.disabled ? { text: `${i + 1}) ${m.label} — ${m.disabled}`, dim: true } : { text: `${i + 1}) ${m.label}` },
          ]),
        ],
      };
    }
    if (mode === "help") {
      const items = helpWords().map((w, i) => ({ ...w, label: `${i + 1}) ${w.text}` }));
      const said = items.filter((w) => !w.inReplies).map((w) => w.label);
      const inReplies = items.filter((w) => w.inReplies).map((w) => w.label);
      const sentence: StyledLine[] = lastLine?.meaning ? [[{ text: `s) ${t("help-sentence")}` }]] : [];
      return {
        title: t("help-title"),
        lines: [
          ...wrapItems(said, width),
          ...sentence,
          ...(inReplies.length ? [[{ text: t("help-in-replies"), dim: true }], ...wrapItems(inReplies, width)] : []),
        ],
      };
    }
    if (replyMode === "pick")
      return {
        title: t("reply-title"),
        lines: pickOptions.map((o, i) => [
          { text: `${i + 1}) ` },
          ...lineSpans(o, new Set()),
          // Once every word in a reply is known, its meaning is no longer news.
          ...(o.meaning && replyNeedsGloss(o) ? [{ text: `  — ${o.meaning}`, dim: true }] : []),
        ]),
      };
    return {
      title: t("reply-title"),
      lines: [
        ...wrapItems(tiles.map((x, i) => `[${i + 1}]${x}`), width, " "),
        [{ text: `${t("tiles-answer")} `, dim: true }, { text: joinTiles(course, tileInput.map((i) => tiles[i])), bold: true }],
      ],
    };
  }

  /** Money, rent (yellow the night it's due, red once late), the parcel, and what to do next. */
  function hudRow(h: HudValues): StyledLine {
    const sep = { text: " · ", dim: true };
    const rent = h.rentLate
      ? { text: t("hud-rent-late"), color: "red" as const }
      : { text: t("hud-rent", { days: h.rentInDays }), ...(h.rentInDays === 0 ? { color: "yellow" as const } : {}) };
    return [
      { text: `${h.currency}${h.wallet}`, bold: true },
      sep,
      rent,
      ...(h.parcel ? [sep, { text: t("hud-parcel"), color: "cyan" as const }] : []),
      // Last, so a narrow screen cuts the goal before the money, the rent or the parcel.
      ...(h.goal ? [sep, { text: h.goal, color: "yellow" as const }] : []),
    ];
  }

  /**
   * Nothing while sound plays (expected, working sound earns no display); ♪ off [m] when muted,
   * "no audio" when there's none here to turn on or off; then the version and the credit, stepped
   * down (the credit, then "Silver Tongue", then all of it) when the key hints on the left leave no room.
   */
  function footerRight(footer: string, cols: number): string {
    const sound = !opts.audio?.available ? t("sound-none") : core.state.sound === false ? t("sound-off") : "";
    const room = cols - 2 - (strWidth(footer) + 2) - 2;
    const v = opts.version;
    if (!v) return sound;
    const choices = [[sound, `Silver Tongue v${v}`, t("credit")], [sound, `Silver Tongue v${v}`], [sound, `v${v}`], [sound]];
    return choices.map((parts) => parts.filter(Boolean).join(" · ")).find((c) => strWidth(c) <= room) ?? sound;
  }

  function render() {
    if (handedOver) return;
    const s = core.state;
    const { cols, rows } = term.size();
    const h = hudValues(course, s, t, opts.now());
    const top = { title: t(`place-${s.place}`), right: t("hud-top", { day: h.day }) };
    if (mode === "notebook") {
      const book = notebookEntries(course, s, t, opts.now());
      const head = notebookHead(book, t, nbView.tab);
      const headRows = head.flatMap((l) => wrapLine(l, innerWidth(cols))).length;
      const height = Math.max(1, rows - 3 - headRows); // top border, the rule under the head, bottom border
      const body = notebookBody(book, t, nbView, cols, height);
      nbView = { ...nbView, top: body.top };
      const footer = t("keys-notebook");
      const frame = { title: t("notebook-title"), right: book.rankLabel, panels: [{ lines: head }, { lines: body.lines }], footer };
      term.write(renderFrame({ ...frame, footerRight: footerRight(footer, cols) }, cols, rows));
      return;
    }
    const [footerId, count] =
      mode === "settings"
        ? ["keys-settings", settingsChoices().length]
        : SETTINGS_MODES.includes(mode)
        ? ["keys-settings-pick", settingsChoices().length]
        : mode === "name"
        ? ["keys-name", 0]
        : mode === "explore"
        ? ["keys-explore", menu().length]
        : mode === "help"
          ? [lastLine?.meaning ? "keys-help-sentence" : "keys-help", helpWords().length]
          : replyMode === "pick"
            ? ["keys-pick", pickOptions.length]
            : ["keys-tiles", tiles.length];
    // [o] is listed last, so a narrow screen drops it first.
    const keys = t(footerId, { keys: keyRange(count) });
    const footer = opts.settings && ["explore", "scene", "help"].includes(mode) ? `${keys} · ${t("keys-o")}` : keys;
    const panels: Panel[] = [
      { lines: [hudRow(h)], drop: 2 },
      { lines: log, grow: true, min: 4 },
      ...(card && mode !== "explore" ? [{ lines: card, drop: 1 }] : []),
      replyPanel(innerWidth(cols)),
    ];
    const left = cols < NARROW ? 0 : 2; // where a line's text starts: after "│ " when wide
    term.write(
      renderFrame({ ...top, panels, footer, footerRight: footerRight(footer, cols) }, cols, rows),
      // Typing a name: the cursor sits after the text, where a phone keyboard shows what's being composed.
      mode === "name" ? { row: rows - 2, col: Math.min(cols - 1 - left, left + 2 + strWidth(nameInput)) } : undefined,
    );
  }

  function press(key: Key) {
    if (handedOver) return;
    if (key.name === "ctrl-c") return opts.quit();
    if (mode === "name") {
      const ch = key.text ?? ([...key.name].length === 1 ? key.name : undefined);
      if (key.name === "return") {
        if (!core.send({ type: "setName", name: nameInput }).some((e) => e.type === "inputRejected")) {
          persist();
          mode = core.state.run ? "scene" : "explore";
        } else push([{ text: t("reject-bad-name"), color: "red" }]);
      } else if (key.name === "backspace") nameInput = [...nameInput].slice(0, -1).join("");
      else if (ch && ch >= " " && [...nameInput].length < MAX_NAME_LENGTH) nameInput += ch;
      return render();
    }
    if (mode === "notebook") {
      const groups = notebookGroups(notebookEntries(course, core.state, t, opts.now()), t);
      const g = Math.max(0, Math.min(nbView.group, groups.length - 1));
      const words = groups[g]?.words ?? [];
      const v = nbView;
      if (key.name === "escape" || key.name === "n") mode = notebookFrom;
      else if (key.name === "1" || key.name === "2") nbView = { ...v, tab: key.name === "1" ? "words" : "notes", top: 0 };
      else if (v.tab === "notes") {
        if (key.name === "down") nbView = { ...v, top: v.top + 1 };
        else if (key.name === "up") nbView = { ...v, top: Math.max(0, v.top - 1) };
      } else if (key.name === "left" || key.name === "right") {
        const next = Math.max(0, Math.min(groups.length - 1, g + (key.name === "right" ? 1 : -1)));
        nbView = { ...v, group: next, word: 0, open: false };
      } else if (key.name === "up" || key.name === "down") {
        const next = Math.max(0, Math.min(words.length - 1, v.word + (key.name === "down" ? 1 : -1)));
        nbView = { ...v, group: g, word: next, open: false };
      } else if (key.name === "return") nbView = { ...v, open: !v.open };
      else if (key.name === "p") {
        hear(words[v.word]?.clips);
        flush();
      }
      return render();
    }
    if (SETTINGS_MODES.includes(mode)) {
      const rows = settingsChoices();
      const n = /^[1-9]$/.test(key.name) ? Number(key.name) - 1 : -1;
      if (key.name === "escape") mode = mode === "settings" ? settingsFrom : "settings";
      else if (n >= 0 && n < rows.length) rows[n].choose();
      return render();
    }
    if (key.name === "o" && opts.settings && (mode === "explore" || mode === "scene" || mode === "help")) {
      settingsFrom = mode;
      mode = "settings";
      return render();
    }
    if (key.name === "n" && mode !== "help") {
      notebookFrom = mode;
      nbView = { tab: "words", group: 0, word: 0, open: false, top: 0 };
      mode = "notebook";
      return render();
    }
    const n = /^[1-9]$/.test(key.name) ? Number(key.name) - 1 : -1;
    if (soundKey(key.name)) {
      // handled: r and m mean the same everywhere but the name prompt and the notebook
    } else if (mode === "explore") {
      const item = n >= 0 ? menu()[n] : undefined;
      if (key.name === "q" || item?.quit) return opts.quit();
      if (item?.input) send(item.input);
    } else if (mode === "help") {
      const word = n >= 0 ? helpWords()[n] : undefined;
      if (word) {
        const wc = wordCard(course, word.word, word.text, core.state);
        lastHelp = wc.clips;
        hear(lastHelp);
        send({ type: "helpWord", word: word.word });
        card = [
          [
            { text: wc.text, bold: true },
            ...(wc.readings.length ? [{ text: ` ${wc.readings.join(" ")}`, color: "yellow" as const }] : []),
            ...(wc.base ? [{ text: ` (${wc.base})`, dim: true }] : []),
            { text: ` — ${wc.gloss}` },
          ],
          // Where it was first heard is an example in context, unless that's the line on screen.
          ...(wc.heard && wc.heard !== lastLine?.text ? [[{ text: t("help-heard", { line: wc.heard }), dim: true }]] : []),
        ];
      }
      if (key.name === "p") {
        hear(lastHelp);
        flush();
      }
      const sentence = key.name === "s" && lastLine ? sentenceCard(course, lastLine) : undefined;
      if (sentence) {
        lastHelp = sentence.clips;
        hear(lastHelp, lastSlow);
        flush();
        // Reading the whole line is not logged as help on each word: the words still have to be
        // recognised in the reply.
        card = [
          [
            { text: sentence.text, bold: true },
            ...(sentence.reading ? [{ text: ` ${sentence.reading}`, color: "yellow" as const }] : []),
            { text: ` — ${sentence.meaning}` },
          ],
        ];
      }
      if (key.name === "escape" || key.name === "w") mode = "scene";
    } else if (key.name === "escape") {
      card = null;
    } else if (key.name === "w") {
      mode = "help";
    } else if (replyMode === "pick") {
      if (n >= 0 && n < pickOptions.length) {
        card = null;
        echo(pickOptions[n].text);
        hear(pickOptions[n].audio);
        send({ type: "reply", choice: n });
      }
    } else if (n >= 0 && n < tiles.length && !tileInput.includes(n)) {
      tileInput = [...tileInput, n];
    } else if (key.name === "backspace") {
      tileInput = tileInput.slice(0, -1);
    } else if (key.name === "return" && tileInput.length) {
      const said = tileEcho(course, core.state, tiles, tileInput);
      card = null;
      echo(said.line.text);
      tileReply = said.clips;
      send({ type: "replyTiles", tiles: tileInput });
    }
    render();
  }

  if (opts.notice) push([{ text: t(opts.notice), color: "yellow" }]);
  tellIntro();
  enterPlace(core.state.place);
  // A note readied mid-scene, then quitting before it was shown, would otherwise lose the one-time
  // hint: core.state.notes.ready survives a save, so it's the source of truth on resume too.
  pendingNotes = new Set(core.state.notes.ready);
  resuming = true;
  apply(describeRun(course, core.state)); // a save made mid-scene resumes in the scene
  flush();
  resuming = false;
  // A course whose lines say the player's name asks for it before anything else.
  if (course.needsName && !core.state.player) mode = "name";
  term.onKey(press);
  term.onResize(render);
  render();
  return { press, render };
}
