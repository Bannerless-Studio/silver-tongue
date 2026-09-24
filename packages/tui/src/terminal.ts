export type Color = "cyan" | "yellow" | "green" | "red" | "magenta";

export interface Span {
  text: string;
  color?: Color;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
}

export type StyledLine = Span[];

/** Key names: "0"-"9", letters, "return", "escape", "backspace", "ctrl-c". */
export interface Key {
  name: string;
}

/** What the TUI needs from a terminal. Backends: Node stdin/stdout, xterm.js. */
export interface Terminal {
  write(lines: StyledLine[]): void;
  onKey(handler: (key: Key) => void): void;
  size(): { cols: number; rows: number };
  close(): void;
}

export const plain = (line: StyledLine): string => line.map((s) => s.text).join("");
