import type { Phase } from "./vn";

export type VnAction =
  | { kind: "advance" }
  | { kind: "choose"; n: number }
  | { kind: "undo" }
  | { kind: "send" }
  | { kind: "open"; overlay: "notebook" | "backlog" | "settings" }
  | { kind: "sound" }
  | { kind: "replay" }
  | { kind: "close" };

export interface KeyContext {
  /** a notebook, backlog, settings, games or word card is open */
  overlay: boolean;
  phase: Phase["kind"];
  /** focus is in a text field */
  typing: boolean;
  /** ctrl, alt or meta is held: the key is the browser's */
  modifier: boolean;
}

const OPEN: Record<string, "notebook" | "backlog" | "settings"> = { n: "notebook", l: "backlog", o: "settings" };

/** What a key (KeyboardEvent.key) does here, or null to leave it to the browser. */
export function keyAction(key: string, ctx: KeyContext): VnAction | null {
  if (ctx.modifier || ctx.typing || ctx.phase === "name") return null;
  if (ctx.overlay) return key === "Escape" ? { kind: "close" } : null;
  const k = key.normalize("NFKC"); // full-width digits from an input method count as digits
  if (/^[1-9]$/.test(k)) return ctx.phase === "beat" ? null : { kind: "choose", n: Number(k) - 1 };
  if (ctx.phase === "tiles" && k === "Backspace") return { kind: "undo" };
  if (ctx.phase === "tiles" && k === "Enter") return { kind: "send" };
  if (ctx.phase === "beat" && (k === " " || k === "Enter")) return { kind: "advance" };
  if (OPEN[k]) return { kind: "open", overlay: OPEN[k] };
  if (k === "m") return { kind: "sound" };
  if (k === "r") return { kind: "replay" };
  return null;
}
