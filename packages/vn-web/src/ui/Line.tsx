import type { RenderedLine, WordId } from "@silver-tongue/core";
import { lineParts, type RubySpan } from "@silver-tongue/view";

/**
 * A line in the language being learned: each word a button to look it up, new words underlined.
 * `ruby`: readings written small under their word groups (see the view's rubyRow and lineParts).
 */
export function Line({ line, fresh = [], ruby = [], onWord }: { line: RenderedLine; fresh?: WordId[]; ruby?: RubySpan[]; onWord?: (w: WordId) => void }) {
  const drawWord = (i: number) => {
    const tk = line.tokens[i];
    const text = line.text.slice(tk.start, tk.end);
    const cls = `word${fresh.includes(tk.word) ? " fresh" : ""}`;
    const word = onWord ? (
      <button key={i} type="button" class={cls} onClick={(e) => (e.stopPropagation(), onWord(tk.word))}>
        {text}
      </button>
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
