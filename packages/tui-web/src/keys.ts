const NAMED: Record<string, string> = {
  Enter: "return",
  Escape: "escape",
  Backspace: "backspace",
  Tab: "tab",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * A browser key (KeyboardEvent.key) as the game's key name, or undefined for keys the game doesn't
 * use. Keys held with ctrl, alt or meta are left to the browser (copy, reload, …).
 */
export function keyName(key: string, mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}): string | undefined {
  if (mods.ctrlKey || mods.altKey || mods.metaKey) return undefined;
  if (NAMED[key]) return NAMED[key];
  // NFKC turns full-width characters from a Chinese or Japanese input method ("１") into plain ones.
  const plain = key.normalize("NFKC");
  return [...plain].length === 1 ? plain.toLowerCase() : undefined;
}

/**
 * Keys the browser should handle instead of the terminal: shortcuts (reload, find, copy),
 * function keys, and Tab so focus can leave the page's terminal, except while the game wants typed
 * text (a reply), where Tab asks for a hint.
 */
export function forBrowser(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, typing = false): boolean {
  return !!(e.ctrlKey || e.altKey || e.metaKey) || /^F\d+$/.test(e.key) || (e.key === "Tab" && !typing);
}

/**
 * Text that reaches the terminal as data rather than key presses (phone keyboards, input methods)
 * as the keys a keyboard would have sent. Enter and backspace become their keys; other control
 * characters and escape sequences are dropped.
 */
export function dataKeys(data: string): { name: string; text?: string }[] {
  if (data === "\r" || data === "\n") return [{ name: "return" }];
  if (data === "\x7f" || data === "\b") return [{ name: "backspace" }];
  if (data.startsWith("\x1b")) return [];
  return [...data]
    .filter((ch) => ch >= " " && ch !== "\x7f")
    .map((ch) => ({ name: keyName(ch) ?? ch, text: ch.normalize("NFKC") }));
}
