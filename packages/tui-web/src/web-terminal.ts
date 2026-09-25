import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal as XTerm } from "@xterm/xterm";
import { toAnsi, type Key, type Terminal } from "@silver-tongue/tui";
import { dataKeys, keyName } from "./keys";

export interface WebTerminal extends Terminal {
  /** Sends a key as if typed: for the on-screen key bar. */
  press(name: string): void;
  /** Stops listening, so a new game can take over the same xterm. */
  dispose(): void;
}

export interface WebTerminalOptions {
  /** a touch screen: the phone keyboard opens only while the game wants typed text */
  touch?: boolean;
  /** told when typed text is wanted (the game shows a cursor) and when it no longer is */
  onTextEntry?: (active: boolean) => void;
}

/** The game's Terminal on an xterm.js instance that fills its container. */
export function createWebTerminal(term: XTerm, fit: FitAddon, win: Window, opts: WebTerminalOptions = {}): WebTerminal {
  let typing: boolean | undefined;
  /**
   * The game shows a cursor only while it wants typed text (a name). Elsewhere the phone keyboard
   * must stay closed: the key bar has every key the game uses. inputmode="none" tells the browser
   * not to open it on focus; blur closes one that is already open.
   */
  const setTyping = (active: boolean) => {
    if (active === typing) return;
    typing = active;
    const ta = term.textarea;
    if (ta) ta.inputMode = active ? "text" : "none";
    if (opts.touch && ta) {
      if (active) term.focus();
      else ta.blur();
    }
    opts.onTextEntry?.(active);
  };
  const keyHandlers: ((k: Key) => void)[] = [];
  const resizeHandlers: (() => void)[] = [];
  const press = (name: string, text?: string) => {
    for (const h of keyHandlers) h(text ? { name, text } : { name });
  };
  // Keys arrive through onKey, and xterm then reports the same keystroke as data. Phone keyboards
  // and input methods send text as data only (their key events say "Unidentified"). So data counts
  // unless the keystroke it came from was already handled as a key.
  let handledByKey = false;
  const onKey = term.onKey(({ domEvent }) => {
    const name = keyName(domEvent.key, domEvent);
    handledByKey = !!name;
    // The typed character, case kept, for text entry (a name).
    if (name) press(name, [...domEvent.key].length === 1 ? domEvent.key.normalize("NFKC") : undefined);
  });
  const onData = term.onData((data) => {
    if (handledByKey) {
      handledByKey = false;
      return;
    }
    for (const k of dataKeys(data)) press(k.name, k.text);
  });
  const onResize = term.onResize(() => {
    for (const h of resizeHandlers) h();
  });
  const refit = () => fit.fit();
  win.addEventListener("resize", refit); // also refit by the page's ResizeObserver
  term.write("\x1b[?25l"); // no cursor: the game draws its own prompt
  if (term.textarea) term.textarea.inputMode = "none"; // until the game asks for text
  return {
    write(lines, cursor) {
      const place = cursor ? `\x1b[${cursor.row + 1};${cursor.col + 1}H\x1b[?25h` : "\x1b[?25l";
      term.write("\x1b[H\x1b[2J" + lines.map(toAnsi).join("\r\n") + place);
      setTyping(!!cursor);
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
