import type { StyledLine } from "./terminal";

const isControl = (cp: number) => cp < 32 || (cp >= 0x7f && cp < 0xa0);

/**
 * Terminal cells a code point takes: 2 for East Asian wide characters and emoji,
 * 0 for combining marks and invisible format characters (zero-width joiner and space).
 * Emoji widths differ between terminals, so UI text should not rely on them.
 */
export function charWidth(cp: number): number {
  if (isControl(cp)) return 0;
  if (/[\p{Mn}\p{Cf}]/u.test(String.fromCodePoint(cp))) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp === 0x1f004 ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
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

/**
 * Cuts or pads a line to exactly `cols` cells. A wide character that would straddle the edge
 * becomes a space. Control characters (tabs, newlines, escapes) become spaces too, so text
 * can never break the layout or send terminal commands.
 */
export function fitLine(line: StyledLine, cols: number): StyledLine {
  const out: StyledLine = [];
  let used = 0;
  for (const span of line) {
    let text = "";
    for (const raw of span.text) {
      const ch = isControl(raw.codePointAt(0)!) ? " " : raw;
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
