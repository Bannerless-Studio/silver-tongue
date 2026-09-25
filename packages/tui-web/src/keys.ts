const NAMED: Record<string, string> = {
  Enter: "return",
  Escape: "escape",
  Backspace: "backspace",
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
  return [...key].length === 1 ? key.toLowerCase() : undefined;
}
