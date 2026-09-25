import { reject, type Ctx } from "./dialogue";
import type { Course, GameState, Note } from "./types";

/** The mentor can be visited here and now: there is one, the player is at their place, and `after` is done. */
export function mentorAvailable(course: Course, state: GameState): boolean {
  const m = course.world.mentor;
  if (!m) return false;
  return state.place === course.world.npcs[m.npc]?.place && (state.scenesDone[m.after] ?? 0) > 0;
}

function triggered(note: Note, state: GameState): boolean {
  // A word counts once it has been heard in a line: looking it up or seeing it among replies isn't enough.
  return "word" in note.trigger ? !!state.words[note.trigger.word]?.first : (state.scenesDone[note.trigger.scene] ?? 0) > 0;
}

/** Notes whose trigger is met but that are neither waiting nor explained yet, in course order. */
export function newlyTriggered(course: Course, state: GameState): string[] {
  const known = new Set([...state.notes.ready, ...state.notes.read]);
  return course.notes.filter((n) => !known.has(n.id) && triggered(n, state)).map((n) => n.id);
}

/** A visit costs a slot and explains every waiting note, in course order. */
export function visitMentor(ctx: Ctx): void {
  const { course, state } = ctx;
  if (state.run) return reject(ctx, "in-scene");
  if (!mentorAvailable(course, state)) return reject(ctx, "no-mentor");
  if (state.slot >= course.world.slotsPerDay) return reject(ctx, "no-slots");
  state.slot += 1;
  const waiting = new Set(state.notes.ready);
  const notes = course.notes.filter((n) => waiting.has(n.id)).map((n) => n.id);
  state.notes = { ready: [], read: [...state.notes.read, ...notes] };
  ctx.ev.push({ type: "mentorVisited", npc: course.world.mentor!.npc, notes });
}
