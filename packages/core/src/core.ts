import { reject, reply, replyTiles, setWord, startScene, type Ctx } from "./dialogue";
import { recordHelp, rankFor } from "./learner";
import { availableSceneIds, endDay } from "./life";
import { newlyTriggered, visitMentor } from "./mentor";
import type { Course, GameEvent, GameState, Input } from "./types";

export { newGame } from "./life";

/** Play-test log length: enough for a few days of play, small enough to keep saves light. */
export const LOG_LIMIT = 500;

export interface CoreDeps {
  now: () => number;
  rng: () => number;
}

export interface Core {
  readonly state: GameState;
  send(input: Input): GameEvent[];
}

function handle(ctx: Ctx, input: Input): void {
  const { course, state } = ctx;
  switch (input.type) {
    case "goTo":
      if (state.run) return reject(ctx, "in-scene");
      if (!course.world.places[state.place]?.links.includes(input.place)) return reject(ctx, "not-linked");
      state.place = input.place;
      ctx.ev.push({ type: "placeEntered", place: input.place });
      return;
    case "startScene":
      return startScene(ctx, input.scene);
    case "reply":
      return reply(ctx, input.choice);
    case "replyTiles":
      return replyTiles(ctx, input.tiles);
    case "helpWord":
      if (!course.words[input.word]) return reject(ctx, "unknown-word");
      return setWord(ctx, input.word, recordHelp);
    case "visitMentor":
      return visitMentor(ctx);
    case "sleep":
      if (state.run) return reject(ctx, "in-scene");
      ctx.ev.push(...endDay(course, state));
      return;
  }
}

/** One entry point: send an input, get events. A rejected input leaves the state untouched. */
export function createCore(course: Course, initial: GameState, deps: CoreDeps): Core {
  const wordIds = Object.keys(course.words);
  // States from before notes and the log existed (not loaded through parseSave) get empty ones.
  let state: GameState = { ...initial, notes: initial.notes ?? { ready: [], read: [] }, log: initial.log ?? [] };
  return {
    get state() {
      return state;
    },
    send(input) {
      const now = deps.now();
      const ctx: Ctx = { course, state: structuredClone(state), now, rng: deps.rng, ev: [] };
      handle(ctx, input);
      if (ctx.ev.some((e) => e.type === "inputRejected")) return ctx.ev;
      ctx.state.log = [...ctx.state.log, { t: now, day: state.day, slot: state.slot, input }].slice(-LOG_LIMIT);
      const before = new Set(availableSceneIds(course, state));
      for (const id of availableSceneIds(course, ctx.state)) {
        if (!before.has(id)) ctx.ev.push({ type: "unlocked", scene: id });
      }
      for (const note of newlyTriggered(course, ctx.state)) {
        ctx.state.notes.ready.push(note);
        ctx.ev.push({ type: "noteReady", note });
      }
      const rank = rankFor(ctx.state.words, wordIds, now);
      if (rank !== rankFor(state.words, wordIds, now)) ctx.ev.push({ type: "rankChanged", rank });
      state = ctx.state;
      return ctx.ev;
    },
  };
}
