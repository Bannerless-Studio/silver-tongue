import type { Phase } from "./quiet";

export type Overlay = "notebook" | "status" | "settings";
export type QuietAction =
  | { kind: "choose"; n: number }
  | { kind: "undo" }
  | { kind: "send" }
  | { kind: "reveal" }
  | { kind: "open"; overlay: Overlay }
  | { kind: "sound" }
  | { kind: "replay" }
  | { kind: "close" };

export interface KeyContext {
  /** a notebook, status, settings or games overlay is open */
  overlay: boolean;
  phase: Phase["kind"];
  /** focus is in a text field */
  typing: boolean;
  /** ctrl, alt or meta is held: the key is the browser's */
  modifier: boolean;
  /** the course uses the Book: it opens with b; n opens the notebook of a course without it */
  book?: boolean;
}

const OPEN: Record<string, Overlay> = { s: "status", o: "settings" };
/** The key that opens the notebook, or the Book. */
export const bookKey = (book: boolean | undefined): string => (book ? "b" : "n");

/** What a key (KeyboardEvent.key) does here, or null to leave it to the browser. */
export function keyAction(key: string, ctx: KeyContext): QuietAction | null {
  if (ctx.modifier || ctx.typing || ctx.phase === "name") return null;
  if (ctx.overlay) return key === "Escape" ? { kind: "close" } : null;
  const k = key.normalize("NFKC"); // full-width digits and ？ from an input method count too
  if (/^[1-9]$/.test(k)) return { kind: "choose", n: Number(k) - 1 };
  if (ctx.phase === "tiles" && k === "Backspace") return { kind: "undo" };
  if (ctx.phase === "tiles" && k === "Enter") return { kind: "send" };
  const lower = k.toLowerCase();
  // w is the text game's look-up key, and the shared opening prose names it.
  if (k === "?" || lower === "w") return { kind: "reveal" };
  if (lower === bookKey(ctx.book)) return { kind: "open", overlay: "notebook" };
  if (OPEN[lower]) return { kind: "open", overlay: OPEN[lower] };
  if (lower === "m") return { kind: "sound" };
  if (lower === "r") return { kind: "replay" };
  return null;
}
