import { PLAYER_MARK, type RenderedLine } from "./types";

export const MAX_NAME_LENGTH = 20;

/** The name as it will be stored, or undefined if it can't be used (empty, too long, control characters). */
export function cleanName(name: string): string | undefined {
  const n = name.trim();
  if (!n || [...n].length > MAX_NAME_LENGTH || /[\p{Cc}\p{Cf}]/u.test(n) || n.includes(PLAYER_MARK)) return undefined;
  return n;
}

/** A line with the player's name in place of the mark; word positions after it shift to match. */
export function personalize(line: RenderedLine, name: string): RenderedLine {
  if (!line.text.includes(PLAYER_MARK) && !line.meaning?.includes(PLAYER_MARK)) return line;
  const grow = name.length - PLAYER_MARK.length;
  const shiftAt = (pos: number) => pos + grow * [...line.text.slice(0, pos).matchAll(new RegExp(PLAYER_MARK, "g"))].length;
  return {
    ...line,
    text: line.text.split(PLAYER_MARK).join(name),
    tokens: line.tokens.map((t) => ({ ...t, start: shiftAt(t.start), end: shiftAt(t.end) })),
    ...(line.meaning !== undefined ? { meaning: line.meaning.split(PLAYER_MARK).join(name) } : {}),
  };
}
