import readline from "node:readline";
import { toAnsi, type Key, type Terminal } from "@silver-tongue/tui";

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
  input.resume(); // a readline prompt before the game (--resume) leaves stdin paused
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
