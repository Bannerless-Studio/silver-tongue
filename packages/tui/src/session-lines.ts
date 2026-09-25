import type { Course, GameState } from "@silver-tongue/core";
import type { Text } from "./text";

/** What a list of saved games needs to know about each one. */
export interface SessionSummary {
  lastPlayed: number;
  state: GameState;
}

/** One numbered line per session, for the --resume picker. */
export function sessionLines(sessions: SessionSummary[], course: Course, t: Text, date: (ms: number) => string): string[] {
  return sessions.map((s, i) => {
    const text = t("resume-item", {
      name: s.state.player ? `${s.state.player} · ` : "",
      day: s.state.day,
      place: t(`place-${s.state.place}`),
      currency: course.world.currency,
      wallet: s.state.wallet,
      done: Object.values(s.state.scenesDone).filter((n) => n > 0).length,
      date: date(s.lastPlayed),
    });
    return `${i + 1}) ${text}`;
  });
}
