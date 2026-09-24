import readline from "node:readline";
import type { Key, Span, StyledLine, Terminal } from "@silver-tongue/tui";

const COLORS: Record<NonNullable<Span["color"]>, number> = { red: 31, green: 32, yellow: 33, magenta: 35, cyan: 36 };

export function toAnsi(line: StyledLine): string {
  return line
    .map((s) => {
      const codes = [
        ...(s.bold ? [1] : []),
        ...(s.dim ? [2] : []),
        ...(s.underline ? [4] : []),
        ...(s.color ? [COLORS[s.color]] : []),
      ];
      return codes.length ? `\x1b[${codes.join(";")}m${s.text}\x1b[0m` : s.text;
    })
    .join("");
}

interface NodeKey {
  name?: string;
  ctrl?: boolean;
}

export function keyName(str: string | undefined, key: NodeKey | undefined): string | undefined {
  if (key?.ctrl && key.name === "c") return "ctrl-c";
  return key?.name ?? str;
}

export function createNodeTerminal(input = process.stdin, output = process.stdout): Terminal {
  readline.emitKeypressEvents(input);
  if (input.isTTY) input.setRawMode(true);
  output.write("\x1b[?1049h\x1b[?25l"); // alternate screen, hide cursor
  const handlers: ((k: Key) => void)[] = [];
  input.on("keypress", (str: string | undefined, key: NodeKey | undefined) => {
    const name = keyName(str, key);
    if (name) for (const h of handlers) h({ name });
  });
  input.on("end", () => {
    for (const h of handlers) h({ name: "ctrl-c" });
  });
  let closed = false;
  const restore = () => {
    if (closed) return;
    closed = true;
    if (input.isTTY) input.setRawMode(false);
    input.pause();
    output.write("\x1b[0m\x1b[?25h\x1b[?1049l");
  };
  process.on("exit", restore);
  return {
    write(lines) {
      output.write("\x1b[H\x1b[2J" + lines.map(toAnsi).join("\r\n"));
    },
    onKey(handler) {
      handlers.push(handler);
    },
    onResize(handler) {
      output.on("resize", handler);
    },
    size() {
      // Some terminals report 0x0 until they are sized.
      return { cols: output.columns || 80, rows: output.rows || 24 };
    },
    /** Restores the terminal. Safe to call more than once. */
    close: restore,
  };
}
