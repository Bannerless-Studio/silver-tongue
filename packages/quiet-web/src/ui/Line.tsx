import { wordState, type RenderedLine, type WordId, type WordRecord } from "@silver-tongue/core";
import { glossPolicy } from "@silver-tongue/view";

/**
 * A line in the language being learned. Each word is a button to look it up. A word heard for the
 * first time is boxed (its gloss follows on the next line), once per transcript; a shaky one is underlined,
 * the rest are bare.
 */
export function Line({ line, fresh = [], words, now, onWord }: {
  line: RenderedLine; fresh?: WordId[]; words?: Record<WordId, WordRecord>; now: number; onWord?: (w: WordId, surface: string) => void;
}) {
  const parts = [];
  let at = 0;
  line.tokens.forEach((tk, i) => {
    if (tk.start > at) parts.push(<span key={`g${i}`}>{line.text.slice(at, tk.start)}</span>);
    const text = line.text.slice(tk.start, tk.end);
    // Only a fresh word is boxed: one never heard but already glossed in this transcript renders bare.
    const policy = fresh.includes(tk.word) ? "gloss" : words && glossPolicy(wordState(words[tk.word], now)) === "mark" ? "mark" : "bare";
    const cls = `w${policy === "gloss" ? " new" : policy === "mark" ? " shaky" : ""}`;
    parts.push(
      onWord ? (
        <button key={i} type="button" class={cls} onClick={(e) => (e.stopPropagation(), onWord(tk.word, text))}>{text}</button>
      ) : (
        <span key={i} class={cls}>{text}</span>
      ),
    );
    at = tk.end;
  });
  if (at < line.text.length) parts.push(<span key="end">{line.text.slice(at)}</span>);
  return <span class="line">{parts}</span>;
}
