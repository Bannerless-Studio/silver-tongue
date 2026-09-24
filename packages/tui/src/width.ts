import type { StyledLine } from "./terminal";

/** Terminal cells a code point takes: 2 for East Asian wide characters, 0 for combining marks. */
export function charWidth(cp: number): number {
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (/\p{Mn}/u.test(String.fromCodePoint(cp))) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

export function strWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch.codePointAt(0)!);
  return w;
}

export function lineWidth(line: StyledLine): number {
  return line.reduce((n, s) => n + strWidth(s.text), 0);
}

/** Cuts or pads a line to exactly `cols` cells. A wide character that would straddle the edge becomes a space. */
export function fitLine(line: StyledLine, cols: number): StyledLine {
  const out: StyledLine = [];
  let used = 0;
  for (const span of line) {
    let text = "";
    for (const ch of span.text) {
      const w = charWidth(ch.codePointAt(0)!);
      if (used + w > cols) break;
      text += ch;
      used += w;
    }
    if (text) out.push({ ...span, text });
    if (used >= cols) break;
  }
  if (used < cols) out.push({ text: " ".repeat(cols - used) });
  return out;
}
