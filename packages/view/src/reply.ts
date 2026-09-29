import { comboKey, joinTiles, personalize, PLAYER_MARK, tilePieces, type Course, type GameState, type RenderedLine } from "@silver-tongue/core";
import { joinTilesForDisplay } from "./tiles";

/** The right reply for the exchange being played. */
export function rightReply(course: Course, state: GameState): RenderedLine | undefined {
  const run = state.run;
  const ex = run && course.scenes.find((x) => x.id === run.scene)?.exchanges[run.exchange];
  return run ? ex?.variants[comboKey(run.combo)]?.reply : undefined;
}

/**
 * What the player said with these tiles. Tiles that make the right reply are shown as the reply
 * itself, punctuation and all; others as placed, with no words to look up. `clips` is the right
 * reply's, said only when the tiles match.
 */
export function tileEcho(course: Course, state: GameState, tiles: string[], placed: number[]): { line: RenderedLine; right: boolean; clips: string[] } {
  const chosen = placed.map((i) => tiles[i]);
  const graded = joinTiles(course, chosen);
  const reply = rightReply(course, state);
  const name = state.player ?? "";
  const right = !!reply && joinTiles(course, tilePieces(reply).map((x) => (x === PLAYER_MARK ? name : x))) === graded;
  return { line: right ? personalize(reply!, name) : { text: joinTilesForDisplay(course, chosen), tokens: [] }, right, clips: reply?.audio ?? [] };
}
