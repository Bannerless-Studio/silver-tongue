import readline from "node:readline";
import { toAnsi, type Key, type Terminal } from "@silver-tongue/tui";

interface NodeKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
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
  // One app at a time: switching course starts a new app, which takes the keys and resizes over.
  const handlers: ((k: Key) => void)[] = [];
  let resized: (() => void) | undefined;
  input.on("keypress", (str: string | undefined, key: NodeKey | undefined) => {
    // An input method commits a whole word at once: one key per character, as if typed.
    if (str && [...str].length > 1 && !key?.name && !key?.ctrl && !key?.meta) {
      for (const ch of str) if (ch >= " ") for (const h of handlers) h({ name: ch, text: ch });
      return;
    }
    const name = keyName(str, key);
    // The typed character, case kept, for text entry (a name); not for control keys.
    const text = str && [...str].length === 1 && str >= " " && !key?.ctrl && !key?.meta ? str : undefined;
    if (name) for (const h of handlers) h(text ? { name, text } : { name });
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
    write(lines, cursor) {
      const place = cursor ? `\x1b[${cursor.row + 1};${cursor.col + 1}H\x1b[?25h` : "\x1b[?25l";
      output.write("\x1b[H\x1b[2J" + lines.map(toAnsi).join("\r\n") + place);
    },
    onKey(handler) {
      handlers.splice(0, handlers.length, handler);
    },
    onResize(handler) {
      if (resized) output.off("resize", resized);
      resized = handler;
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
