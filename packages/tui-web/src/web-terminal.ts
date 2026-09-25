import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal as XTerm } from "@xterm/xterm";
import { toAnsi, type Key, type Terminal } from "@silver-tongue/tui";
import { keyName } from "./keys";

export interface WebTerminal extends Terminal {
  /** Sends a key as if typed: for the on-screen key bar. */
  press(name: string): void;
  /** Stops listening, so a new game can take over the same xterm. */
  dispose(): void;
}

/** The game's Terminal on an xterm.js instance that fills its container. */
export function createWebTerminal(term: XTerm, fit: FitAddon, win: Window): WebTerminal {
  const keyHandlers: ((k: Key) => void)[] = [];
  const resizeHandlers: (() => void)[] = [];
  const press = (name: string) => {
    for (const h of keyHandlers) h({ name });
  };
  const onKey = term.onKey(({ domEvent }) => {
    const name = keyName(domEvent.key, domEvent);
    if (name) press(name);
  });
  const onResize = term.onResize(() => {
    for (const h of resizeHandlers) h();
  });
  const refit = () => fit.fit();
  win.addEventListener("resize", refit); // also refit by the page's ResizeObserver
  term.write("\x1b[?25l"); // no cursor: the game draws its own prompt
  return {
    write(lines) {
      term.write("\x1b[H\x1b[2J" + lines.map(toAnsi).join("\r\n"));
    },
    onKey(handler) {
      keyHandlers.push(handler);
    },
    onResize(handler) {
      resizeHandlers.push(handler);
    },
    size() {
      return { cols: term.cols, rows: term.rows };
    },
    close() {},
    press,
    dispose() {
      onKey.dispose();
      onResize.dispose();
      win.removeEventListener("resize", refit);
      keyHandlers.length = 0;
      resizeHandlers.length = 0;
    },
  };
}
