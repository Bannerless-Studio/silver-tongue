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

type Piece = { text: string; span: StyledLine[number] };

/** Breaks a line into pieces that may not be split: a word with its trailing spaces, or one wide character. */
function pieces(line: StyledLine): Piece[] {
  const out: Piece[] = [];
  for (const span of line) {
    let cur = "";
    const flush = () => {
      if (cur) out.push({ text: cur, span });
      cur = "";
    };
    for (const ch of span.text) {
      const wide = charWidth(ch.codePointAt(0)!) === 2;
      if (ch === " ") cur += ch;
      else if (wide || cur.endsWith(" ")) {
        flush();
        cur = ch;
        if (wide) flush();
      } else cur += ch;
    }
    flush();
  }
  return out;
}

/**
 * Wraps a line to `cols` cells: at spaces, between CJK characters, and inside a word only when
 * the word alone is longer than a line. Spans keep their style across the break.
 */
export function wrapLine(line: StyledLine, cols: number): StyledLine[] {
  const lines: StyledLine[] = [];
  let cur: StyledLine = [];
  let curFrom: object | undefined; // the source span of cur's last span
  let used = 0;
  const finish = () => {
    const last = cur.at(-1);
    if (last) last.text = last.text.replace(/ +$/, "");
    lines.push(cur.filter((s) => s.text));
    cur = [];
    curFrom = undefined;
    used = 0;
  };
  const add = ({ text, span }: Piece) => {
    if (used > 0 && used + strWidth(text.replace(/ +$/, "")) > cols) finish();
    if (used === 0 && lines.length > 0) text = text.replace(/^ +/, "");
    if (!text) return;
    if (curFrom === span) cur[cur.length - 1].text += text;
    else cur.push({ ...span, text });
    curFrom = span;
    used += strWidth(text);
  };
  for (const p of pieces(line)) {
    if (strWidth(p.text.replace(/ +$/, "")) > cols) for (const ch of p.text) add({ text: ch, span: p.span });
    else add(p);
  }
  finish();
  return lines;
}
