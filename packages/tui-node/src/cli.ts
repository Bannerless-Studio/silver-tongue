import { parseArgs } from "node:util";

export const USAGE = `Usage: silver-tongue [--new | --resume | --export | --import <line>] [--learn <code>] [--read <code>]

  (no flag)        continue the game you played last
  --new            start a new game (your other games are kept)
  --resume         choose one of your saved games
  --export         print the game you played last as one line of text
  --import <line>  add a game exported with --export (nothing is overwritten);
                   use --import - to paste the line on standard input
  --learn <code>   learn this language (zh) or course (zh-china); remembered
  --read <code>    read the game in this language (en); remembered
  --version        print the version
  --help           show this help`;

export type Flags =
  | { mode: "continue" | "new" | "resume" | "export"; coursePath?: string; learn?: string; read?: string }
  | { mode: "import"; line: string; coursePath?: string; learn?: string; read?: string }
  | { mode: "help" }
  | { mode: "version" }
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
        learn: { type: "string" },
        read: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    const unknown = /Unknown option '([^']+)'/.exec((e as Error).message);
    return { mode: "error", message: unknown ? `unknown option ${unknown[1]}` : (e as Error).message };
  }
  const { values, positionals } = parsed;
  if (values.help) return { mode: "help" };
  if (values.version) return { mode: "version" };
  const chosen = (["new", "resume", "export", "import"] as const).filter((k) => values[k] !== undefined && values[k] !== false);
  if (chosen.length > 1) return { mode: "error", message: `use one of ${chosen.map((k) => `--${k}`).join(", ")}, not several` };
  // A course file path, for playing a course built from source.
  const course = {
    ...(positionals[0] ? { coursePath: positionals[0] } : {}),
    ...(values.learn !== undefined ? { learn: values.learn } : {}),
    ...(values.read !== undefined ? { read: values.read } : {}),
  };
  if (positionals[0] && (values.learn !== undefined || values.read !== undefined))
    return { mode: "error", message: "a course file has one language and one reading language: leave out --learn and --read" };
  if (values.import !== undefined) return { mode: "import", line: values.import, ...course };
  const mode = chosen[0] === "new" || chosen[0] === "resume" || chosen[0] === "export" ? chosen[0] : "continue";
  return { mode, ...course };
}

/** The index picked from `count` sessions, "cancel" for enter or q, "again" for anything else. */
export function pickAnswer(answer: string, count: number): number | "cancel" | "again" {
  const a = answer.trim().toLowerCase();
  if (a === "" || a === "q") return "cancel";
  const n = Number(a);
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : "again";
}
