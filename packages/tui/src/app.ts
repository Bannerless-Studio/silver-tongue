import {
  availableSceneIds,
  describeRun,
  rankFor,
  type Core,
  type Course,
  type GameEvent,
  type GameState,
  type Input,
  type RenderedLine,
  type WordId,
} from "@silver-tongue/core";
import { lineSpans, renderScreen, wrapItems } from "./screen";
import type { Key, StyledLine, Terminal } from "./terminal";
import { makeText, type Text } from "./text";

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
}

type MenuItem = { label: string; input?: Input; quit?: true };
type Mode = "explore" | "scene" | "help";

export interface App {
  press(key: Key): void;
  render(): void;
}

const LOG_LIMIT = 200;

export function startApp(opts: AppOptions): App {
  const { course, core, term } = opts;
  const t: Text = makeText(course.learnerFtl);
  const wordIds = Object.keys(course.words);

  let mode: Mode = "explore";
  let log: StyledLine[] = [];
  let pickOptions: RenderedLine[] = [];
  let tiles: string[] = [];
  let replyMode: "pick" | "tiles" = "pick";
  let tileInput: number[] = [];
  let lastLine: RenderedLine | null = null;

  const push = (...lines: StyledLine[]) => {
    log = [...log, ...lines].slice(-LOG_LIMIT);
  };
  const npcName = (npc: string) => t(`npc-${npc}`);
  const say = (npc: string, line: RenderedLine, fresh: Set<WordId>, suffix = ""): StyledLine => [
    { text: `${npcName(npc)}${suffix}: `, color: "cyan", bold: true },
    ...lineSpans(line, fresh),
  ];

  /** The number keys that choose among `n` items: "1", "1-4". */
  const keyRange = (n: number) => (n <= 1 ? "1" : `1-${Math.min(n, 9)}`);
  const echo = (text: string) => push([{ text: `${t("you")}: `, color: "green", bold: true }, { text }]);

  /** Optional narration: shown when the learner text has it. */
  const narrate = (id: string, args?: Record<string, string | number>) => {
    if (t.has(id)) push([{ text: t(id, args), dim: true }]);
  };

  /** The opening story, for a game that hasn't started yet. Lines intro-1, intro-2, … */
  function tellIntro() {
    const s = core.state;
    const fresh = s.day === 1 && s.slot === 0 && !s.run && !Object.keys(s.scenesDone).length && !Object.keys(s.words).length;
    if (!fresh) return;
    const args = { currency: course.world.currency, wallet: s.wallet, rent: course.world.rentPerWeek };
    for (let i = 1; t.has(`intro-${i}`); i++) push([{ text: t(`intro-${i}`, args) }], []);
  }

  function enterPlace(place: string) {
    push([], [{ text: t(`place-${place}`), bold: true }], [{ text: t(`place-${place}-desc`), dim: true }]);
  }

  function apply(events: GameEvent[]) {
    const fresh = new Set(
      events.flatMap((e) => (e.type === "wordStateChanged" && e.from === "unseen" ? [e.word] : [])),
    );
    for (const e of events) {
      switch (e.type) {
        case "placeEntered":
          enterPlace(e.place);
          break;
        case "sceneStarted":
          mode = "scene";
          push([]);
          narrate(`scene-${e.scene}-start`);
          break;
        case "lineSpoken":
          lastLine = e.line;
          push(say(e.npc, e.line, fresh));
          break;
        case "replyOptions":
          replyMode = e.mode;
          tileInput = [];
          if (e.mode === "pick") pickOptions = e.options;
          else tiles = e.tiles;
          break;
        case "actionPerformed":
          if (!e.matched) push([{ text: t("mismatch"), color: "yellow" }]);
          break;
        case "npcReacted":
          // Word help keeps offering the request the player got wrong, not the reaction.
          push(say(e.npc, e.line, fresh));
          break;
        case "lineRephrased":
          lastLine = e.line;
          push(say(e.npc, e.line, fresh, ` ${t("rephrased")}`));
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
          push([{ text: t("trust-up", { npc: npcName(e.npc), trust: e.trust }), color: "magenta" }]);
          break;
        case "sceneEnded":
          mode = "explore";
          narrate(`scene-${e.scene}-end`);
          push([{ text: t("scene-done", { currency: course.world.currency, earned: e.earned }), bold: true }]);
          break;
        case "unlocked":
          push([{ text: t("unlocked", { scene: t(`scene-${e.scene}`) }), color: "green" }]);
          break;
        case "rankChanged":
          push([{ text: t("rank-up", { rank: t(`rank-${e.rank}`) }), color: "yellow", bold: true }]);
          break;
        case "dayEnded":
          push([], [{ text: t("day-ended", { day: e.day }), dim: true }]);
          break;
        case "inputRejected":
          push([{ text: t(`reject-${e.reason}`), color: "red" }]);
          break;
        case "wordStateChanged":
          break;
      }
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
    if (!events.some((e) => e.type === "inputRejected")) persist();
  }

  function menu(): MenuItem[] {
    const s = core.state;
    const items: MenuItem[] = [];
    for (const id of availableSceneIds(course, s)) {
      const scene = course.scenes.find((x) => x.id === id)!;
      if (scene.place !== s.place) continue;
      items.push({ label: t("menu-talk", { npc: npcName(scene.npc), scene: t(`scene-${id}`) }), input: { type: "startScene", scene: id } });
    }
    for (const p of course.world.places[s.place].links) {
      items.push({ label: t("menu-go", { place: t(`place-${p}`) }), input: { type: "goTo", place: p } });
    }
    // Sleep and quit always keep their keys; the content checker keeps places within 7 other items.
    return [...items.slice(0, 7), { label: t("menu-sleep"), input: { type: "sleep" } }, { label: t("menu-quit"), quit: true }];
  }

  /**
   * Words to look up: those of the last line, then (when picking a reply) the other words in the
   * replies, so a reply the player has never heard can be worked out. At most 9, one per number key.
   */
  function helpWords(): { text: string; word: WordId; inReplies: boolean }[] {
    if (!lastLine) return [];
    const pieces = (l: RenderedLine) => l.tokens.map((tk) => ({ text: l.text.slice(tk.start, tk.end), word: tk.word }));
    const said = pieces(lastLine).map((p) => ({ ...p, inReplies: false }));
    const seen = new Set(said.map((p) => p.word));
    const replies = replyMode === "pick" ? pickOptions.flatMap(pieces) : [];
    const extra = replies.filter((p) => !seen.has(p.word) && seen.add(p.word)).map((p) => ({ ...p, inReplies: true }));
    return [...said, ...extra].slice(0, 9);
  }

  /** `width` is the room inside the frame, for wrapping tiles and help words. */
  function prompt(width: number): StyledLine[] {
    if (mode === "explore") {
      return [[{ text: t("menu-title"), dim: true }], ...menu().map((m, i) => [{ text: `${i + 1}) ${m.label}` }])];
    }
    if (mode === "help") {
      const items = helpWords().map((w, i) => ({ ...w, label: `${i + 1}) ${w.text}` }));
      const said = items.filter((w) => !w.inReplies).map((w) => w.label);
      const inReplies = items.filter((w) => w.inReplies).map((w) => w.label);
      const sentence: StyledLine[] = lastLine?.meaning ? [[{ text: `s) ${t("help-sentence")}` }]] : [];
      return [
        [{ text: t("help-title"), dim: true }],
        ...wrapItems(said, width),
        ...sentence,
        ...(inReplies.length ? [[{ text: t("help-in-replies"), dim: true }], ...wrapItems(inReplies, width)] : []),
      ];
    }
    const title: StyledLine = [{ text: t("reply-title"), dim: true }];
    if (replyMode === "pick") return [title, ...pickOptions.map((o, i) => [{ text: `${i + 1}) ` }, ...lineSpans(o, new Set())])];
    return [
      title,
      ...wrapItems(
        tiles.map((x, i) => `[${i + 1}]${x}`),
        width,
        " ",
      ),
      [{ text: `${t("tiles-answer")} `, dim: true }, { text: tileInput.map((i) => tiles[i]).join(""), bold: true }],
    ];
  }

  function render() {
    const s = core.state;
    const { cols, rows } = term.size();
    const hud = t("hud", {
      day: s.day,
      slot: s.slot,
      slots: course.world.slotsPerDay,
      currency: course.world.currency,
      wallet: s.wallet,
      rank: t(`rank-${rankFor(s.words, wordIds, opts.now())}`),
    });
    const [footerId, count] =
      mode === "explore"
        ? ["keys-explore", menu().length]
        : mode === "help"
          ? [lastLine?.meaning ? "keys-help-sentence" : "keys-help", helpWords().length]
          : replyMode === "pick"
            ? ["keys-pick", pickOptions.length]
            : ["keys-tiles", tiles.length];
    const footer = t(footerId, { keys: keyRange(count) });
    term.write(renderScreen({ title: t(`place-${s.place}`), hud, log, prompt: prompt(cols - 4), footer }, cols, rows));
  }

  function press(key: Key) {
    if (key.name === "ctrl-c") return opts.quit();
    const n = /^[1-9]$/.test(key.name) ? Number(key.name) - 1 : -1;
    if (mode === "explore") {
      const item = n >= 0 ? menu()[n] : undefined;
      if (key.name === "q" || item?.quit) return opts.quit();
      if (item?.input) send(item.input);
    } else if (mode === "help") {
      const word = n >= 0 ? helpWords()[n] : undefined;
      if (word) {
        send({ type: "helpWord", word: word.word });
        const w = course.words[word.word];
        push([
          { text: w.w, bold: true },
          ...(w.pron ? [{ text: ` ${w.pron}`, color: "yellow" as const }] : []),
          { text: ` — ${w.gloss}` },
        ]);
      }
      if (key.name === "s" && lastLine?.meaning) {
        // Reading the whole line is not logged as help on each word: the words still have to be
        // recognised in the reply.
        const pron = lastLine.tokens.flatMap((tk) => course.words[tk.word]?.pron ?? []).join(" ");
        push([
          { text: lastLine.text, bold: true },
          ...(pron ? [{ text: ` ${pron}`, color: "yellow" as const }] : []),
          { text: ` — ${lastLine.meaning}` },
        ]);
      }
      if (key.name === "escape" || key.name === "w") mode = "scene";
    } else if (key.name === "w") {
      mode = "help";
    } else if (replyMode === "pick") {
      if (n >= 0 && n < pickOptions.length) {
        echo(pickOptions[n].text);
        send({ type: "reply", choice: n });
      }
    } else if (n >= 0 && n < tiles.length && !tileInput.includes(n)) {
      tileInput = [...tileInput, n];
    } else if (key.name === "backspace") {
      tileInput = tileInput.slice(0, -1);
    } else if (key.name === "return" && tileInput.length) {
      echo(tileInput.map((i) => tiles[i]).join(""));
      send({ type: "replyTiles", tiles: tileInput });
    }
    render();
  }

  if (opts.notice) push([{ text: t(opts.notice), color: "yellow" }]);
  tellIntro();
  enterPlace(core.state.place);
  apply(describeRun(course, core.state)); // a save made mid-scene resumes in the scene
  term.onKey(press);
  term.onResize(render);
  render();
  return { press, render };
}
