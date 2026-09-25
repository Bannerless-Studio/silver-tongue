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
  const press = (name: string, text?: string) => {
    for (const h of keyHandlers) h(text ? { name, text } : { name });
  };
  const onKey = term.onKey(({ domEvent }) => {
    const name = keyName(domEvent.key, domEvent);
    // The typed character, case kept, for text entry (a name).
    const text = [...domEvent.key].length === 1 ? domEvent.key.normalize("NFKC") : undefined;
    lastKeyText = domEvent.key;
    if (name) press(name, text);
  });
  // Text from an input method (Chinese, Japanese, a phone keyboard) arrives as data, not keys.
  // A key that already arrived through onKey ("é" on a keyboard layout) also shows up here once.
  let lastKeyText = "";
  const onData = term.onData((data) => {
    if (data === lastKeyText) {
      lastKeyText = "";
      return;
    }
    if (/[^\x00-\x7f]/.test(data)) for (const ch of data) press(ch, ch);
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
      onData.dispose();
      onResize.dispose();
      win.removeEventListener("resize", refit);
      keyHandlers.length = 0;
      resizeHandlers.length = 0;
    },
  };
}
