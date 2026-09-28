export type Color = "cyan" | "yellow" | "green" | "red" | "magenta" | "blue" | "white";

export interface Span {
  text: string;
  color?: Color;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  /** swapped colours: a badge ("new") */
  inverse?: boolean;
}

export type StyledLine = Span[];

/** Key names: "0"-"9", letters, "return", "escape", "backspace", "up", "down", "left", "right", "ctrl-c". */
export interface Key {
  name: string;
  /** the character typed, case kept ("J"), for text entry; absent for keys like arrows */
  text?: string;
}

/** What the TUI needs from a terminal. Backends: Node stdin/stdout, xterm.js. */
export interface Terminal {
  /** Draws a frame. `cursor` (0-based) shows the text cursor there, for typing; otherwise it's hidden. */
  write(lines: StyledLine[], cursor?: { row: number; col: number }): void;
  onKey(handler: (key: Key) => void): void;
  /** Called after the terminal changes size (window resize, phone rotation). */
  onResize(handler: () => void): void;
  size(): { cols: number; rows: number };
  close(): void;
}

export const plain = (line: StyledLine): string => line.map((s) => s.text).join("");
