import type { Span, StyledLine } from "./terminal";

const COLORS: Record<NonNullable<Span["color"]>, number> = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37 };

/** A styled line as ANSI escapes: what both the Node and the browser terminal draw. */
export function toAnsi(line: StyledLine): string {
  return line
    .map((s) => {
      const codes = [
        ...(s.bold ? [1] : []),
        ...(s.dim ? [2] : []),
        ...(s.underline ? [4] : []),
        ...(s.inverse ? [7] : []),
        ...(s.color ? [COLORS[s.color]] : []),
      ];
      return codes.length ? `\x1b[${codes.join(";")}m${s.text}\x1b[0m` : s.text;
    })
    .join("");
}
