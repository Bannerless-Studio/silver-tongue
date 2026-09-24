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
  save: (state: GameState) => void;
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

  function send(input: Input) {
    const events = core.send(input);
    apply(events);
    if (!events.some((e) => e.type === "inputRejected")) opts.save(core.state);
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

  function helpWords(): { text: string; word: WordId }[] {
    if (!lastLine) return [];
    const line = lastLine;
    return line.tokens.map((tk) => ({ text: line.text.slice(tk.start, tk.end), word: tk.word }));
  }

  /** `width` is the room inside the frame, for wrapping tiles and help words. */
  function prompt(width: number): StyledLine[] {
    if (mode === "explore") {
      return [[{ text: t("menu-title"), dim: true }], ...menu().map((m, i) => [{ text: `${i + 1}) ${m.label}` }])];
    }
    if (mode === "help") {
      const words = helpWords().map((w, i) => `${i + 1}) ${w.text}`);
      return [[{ text: t("help-title"), dim: true }], ...wrapItems(words, width)];
    }
    if (replyMode === "pick") return pickOptions.map((o, i) => [{ text: `${i + 1}) ` }, ...lineSpans(o, new Set())]);
    return [
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
    const footer = t(mode === "explore" ? "keys-explore" : mode === "help" ? "keys-help" : replyMode === "pick" ? "keys-pick" : "keys-tiles");
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
      if (key.name === "escape" || key.name === "w") mode = "scene";
    } else if (key.name === "w") {
      mode = "help";
    } else if (replyMode === "pick") {
      if (n >= 0 && n < pickOptions.length) send({ type: "reply", choice: n });
    } else if (n >= 0 && n < tiles.length && !tileInput.includes(n)) {
      tileInput = [...tileInput, n];
    } else if (key.name === "backspace") {
      tileInput = tileInput.slice(0, -1);
    } else if (key.name === "return" && tileInput.length) {
      send({ type: "replyTiles", tiles: tileInput });
    }
    render();
  }

  if (opts.notice) push([{ text: t(opts.notice), color: "yellow" }]);
  enterPlace(core.state.place);
  apply(describeRun(course, core.state)); // a save made mid-scene resumes in the scene
  term.onKey(press);
  term.onResize(render);
  render();
  return { press, render };
}
