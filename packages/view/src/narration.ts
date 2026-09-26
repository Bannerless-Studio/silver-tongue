import type { Course, GameEvent, GameState } from "@silver-tongue/core";
import type { Text } from "./text";

export type ActionPerformed = Extract<GameEvent, { type: "actionPerformed" }>;
export interface NarrationLine {
  text: string;
  tone: "plain" | "warn";
}

/** An action's parameters as narration variables: concept values become learner-language names. */
const actionArgs = (course: Course, a: Record<string, string>) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, course.conceptNames[v] ?? v]));

/**
 * What the reply did (action-<name>) and, on a mix-up, what was asked (asked-<name> of the asked
 * action), falling back to the generic mismatch line. Wrong tiles did nothing recognisable, so only
 * what was asked is narrated.
 */
export function actionNarration(course: Course, t: Text, e: Pick<ActionPerformed, "action" | "expected" | "matched" | "tilesWrong">): NarrationLine[] {
  const out: NarrationLine[] = [];
  if (!e.tilesWrong && t.has(`action-${e.action.action}`)) out.push({ text: t(`action-${e.action.action}`, actionArgs(course, e.action)), tone: "plain" });
  if (e.matched) return out;
  if (t.has(`asked-${e.expected.action}`)) out.push({ text: t(`asked-${e.expected.action}`, actionArgs(course, e.expected)), tone: "warn" });
  else out.push({ text: t("mismatch"), tone: "warn" });
  return out;
}

/** The opening story (intro-1, intro-2, …), for a game that hasn't started yet; otherwise none. */
export function introLines(course: Course, state: GameState, t: Text): string[] {
  const fresh =
    state.day === 1 && state.slot === 0 && !state.run && state.place === course.world.start && !Object.keys(state.scenesDone).length && !Object.keys(state.words).length;
  if (!fresh) return [];
  const args = { currency: course.world.currency, wallet: state.wallet, rent: course.world.rentPerWeek };
  const out: string[] = [];
  for (let i = 1; t.has(`intro-${i}`); i++) out.push(t(`intro-${i}`, args));
  return out;
}
