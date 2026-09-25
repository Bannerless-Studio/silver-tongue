import { parseArgs } from "node:util";
import { parseSave, serialize, type Course, type GameState, type ParseResult } from "@silver-tongue/core";
import type { Text } from "@silver-tongue/tui";
import type { Session } from "./sessions";

export const USAGE = `Usage: silver-tongue [--new | --resume | --export | --import <line>]

  (no flag)        continue the game you played last
  --new            start a new game (your other games are kept)
  --resume         choose one of your saved games
  --export         print the game you played last as one line of text
  --import <line>  add a game exported with --export (nothing is overwritten)
  --help           show this help`;

export type Flags =
  | { mode: "continue" | "new" | "resume" | "export"; coursePath?: string }
  | { mode: "import"; line: string; coursePath?: string }
  | { mode: "help" }
  | { mode: "error"; message: string };

export function parseFlags(args: string[]): Flags {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        new: { type: "boolean" },
        resume: { type: "boolean" },
        export: { type: "boolean" },
        import: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    const unknown = /Unknown option '([^']+)'/.exec((e as Error).message);
    return { mode: "error", message: unknown ? `unknown option ${unknown[1]}` : (e as Error).message };
  }
  const { values, positionals } = parsed;
  if (values.help) return { mode: "help" };
  const chosen = (["new", "resume", "export", "import"] as const).filter((k) => values[k] !== undefined && values[k] !== false);
  if (chosen.length > 1) return { mode: "error", message: `use one of ${chosen.map((k) => `--${k}`).join(", ")}, not several` };
  // A course file path, for playing a course built from source.
  const course = positionals[0] ? { coursePath: positionals[0] } : {};
  if (values.import !== undefined) return { mode: "import", line: values.import, ...course };
  const mode = chosen[0] === "new" || chosen[0] === "resume" || chosen[0] === "export" ? chosen[0] : "continue";
  return { mode, ...course };
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

/** A save as one line of text: base64 of its JSON. */
export function encodeSave(state: GameState): string {
  return Buffer.from(serialize(state), "utf8").toString("base64");
}

/** The reverse of encodeSave, as strict as loading a save. */
export function decodeSave(line: string, course: Course): ParseResult {
  const text = line.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return { ok: false, reason: "not-base64" };
  return parseSave(Buffer.from(text, "base64").toString("utf8"), course);
}
