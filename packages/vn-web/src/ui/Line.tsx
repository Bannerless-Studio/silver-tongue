import type { RenderedLine, WordId } from "@silver-tongue/core";
import type { RubySpan } from "@silver-tongue/view";

/**
 * A line in the language being learned: each word a button to look it up, new words underlined.
 * `ruby`: readings written small under their words (see the view's rubyRow).
 */
export function Line({ line, fresh = [], ruby = [], onWord }: { line: RenderedLine; fresh?: WordId[]; ruby?: RubySpan[]; onWord?: (w: WordId) => void }) {
  const parts = [];
  let at = 0;
  line.tokens.forEach((tk, i) => {
    if (tk.start > at) parts.push(<span key={`g${i}`}>{line.text.slice(at, tk.start)}</span>);
    const text = line.text.slice(tk.start, tk.end);
    const cls = `word${fresh.includes(tk.word) ? " fresh" : ""}`;
    const word = onWord ? (
      <button key={i} type="button" class={cls} onClick={(e) => (e.stopPropagation(), onWord(tk.word))}>
        {text}
      </button>
    ) : (
      <span key={i} class={cls}>{text}</span>
    );
    const reading = ruby.find((r) => r.start === tk.start);
    parts.push(reading ? <ruby key={i}>{word}<rt>{reading.text}</rt></ruby> : word);
    at = tk.end;
  });
  if (at < line.text.length) parts.push(<span key="end">{line.text.slice(at)}</span>);
  return <span class="line">{parts}</span>;
}
