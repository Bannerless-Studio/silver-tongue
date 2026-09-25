import { parseArgs } from "node:util";
import type { Course } from "@silver-tongue/core";
import type { Text } from "@silver-tongue/tui";
import type { Session } from "./sessions";

export const USAGE = `Usage: silver-tongue [--new | --resume]

  (no flag)   continue the game you played last
  --new       start a new game (your other games are kept)
  --resume    choose one of your saved games
  --help      show this help`;

export type Flags =
  | { mode: "continue" | "new" | "resume"; coursePath?: string }
  | { mode: "help" }
  | { mode: "error"; message: string };

export function parseFlags(args: string[]): Flags {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: { new: { type: "boolean" }, resume: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    });
  } catch (e) {
    const unknown = /Unknown option '([^']+)'/.exec((e as Error).message);
    return { mode: "error", message: unknown ? `unknown option ${unknown[1]}` : (e as Error).message };
  }
  const { values, positionals } = parsed;
  if (values.help) return { mode: "help" };
  if (values.new && values.resume) return { mode: "error", message: "use --new or --resume, not both" };
  const mode = values.new ? "new" : values.resume ? "resume" : "continue";
  // A course file path, for playing a course built from source.
  return positionals[0] ? { mode, coursePath: positionals[0] } : { mode };
}

/** One numbered line per session, for the --resume picker. */
export function sessionLines(sessions: Session[], course: Course, t: Text, date: (ms: number) => string): string[] {
  return sessions.map((s, i) => {
    const text = t("resume-item", {
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

/** The index picked from `count` sessions, "cancel" for enter or q, "again" for anything else. */
export function pickAnswer(answer: string, count: number): number | "cancel" | "again" {
  const a = answer.trim().toLowerCase();
  if (a === "" || a === "q") return "cancel";
  const n = Number(a);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : "again";
}
