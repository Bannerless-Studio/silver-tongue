import { wordState, type RenderedLine, type WordId, type WordRecord } from "@silver-tongue/core";
import { glossPolicy, lineParts, type RubySpan } from "@silver-tongue/view";

/**
 * A line in the language being learned. Each word is a button to look it up. A word heard for the
 * first time is boxed (its gloss follows on the next line), once per transcript; a shaky one is underlined,
 * the rest are bare. `ruby`: readings written small under their word groups (see the view's quietRuby and lineParts).
 * `sounded`: indexes of tokens the player already sounded out on the desk, drawn bold (see soundedTokens).
 * `book`: a course with the Book, where every word is bare and its reading is the one mark (see glossPolicy).
 */
export function Line({ line, fresh = [], words, now, ruby = [], book = false, sounded, onWord }: {
  line: RenderedLine; fresh?: WordId[]; words?: Record<WordId, WordRecord>; now: number; ruby?: RubySpan[]; book?: boolean; sounded?: ReadonlySet<number>; onWord?: (w: WordId, surface: string) => void;
}) {
  const drawWord = (i: number) => {
    const tk = line.tokens[i];
    const text = line.text.slice(tk.start, tk.end);
    // Only a fresh word is boxed: one never heard but already glossed in this transcript renders bare.
    const policy = fresh.includes(tk.word) ? "gloss" : words && glossPolicy(wordState(words[tk.word], now), book) === "mark" ? "mark" : "bare";
    const cls = `w${policy === "gloss" ? " new" : policy === "mark" ? " shaky" : ""}${sounded?.has(i) ? " sounded" : ""}`;
    const word = onWord ? (
      <button key={i} type="button" class={cls} onClick={(e) => (e.stopPropagation(), onWord(tk.word, text))}>{text}</button>
    ) : (
      <span key={i} class={cls}>{text}</span>
    );
    return word;
  };
  const parts = lineParts(line, ruby).map((p, n) => {
    if ("gap" in p) return <span key={`g${n}`}>{p.gap}</span>;
    if (p.reading === undefined) return drawWord(p.tokens[0]);
    return <ruby key={p.tokens[0]}>{p.tokens.map(drawWord)}{p.tail}<rt>{p.reading}</rt></ruby>;
  });
  return <span class="line">{parts}</span>;
}
