import type { RenderedLine, WordId } from "@silver-tongue/core";

/** A line in the language being learned: each word a button to look it up, new words underlined. */
export function Line({ line, fresh = [], onWord }: { line: RenderedLine; fresh?: WordId[]; onWord?: (w: WordId) => void }) {
  const parts = [];
  let at = 0;
  line.tokens.forEach((tk, i) => {
    if (tk.start > at) parts.push(<span key={`g${i}`}>{line.text.slice(at, tk.start)}</span>);
    const text = line.text.slice(tk.start, tk.end);
    const cls = `word${fresh.includes(tk.word) ? " fresh" : ""}`;
    parts.push(
      onWord ? (
        <button key={i} type="button" class={cls} onClick={(e) => (e.stopPropagation(), onWord(tk.word))}>
          {text}
        </button>
      ) : (
        <span key={i} class={cls}>{text}</span>
      ),
    );
    at = tk.end;
  });
  if (at < line.text.length) parts.push(<span key="end">{line.text.slice(at)}</span>);
  return <span class="line">{parts}</span>;
}
