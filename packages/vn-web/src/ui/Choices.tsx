import type { WordId } from "@silver-tongue/core";
import type { Vn, VnView } from "../vn";
import { Line } from "./Line";

/** Choice buttons mid-stage: the place's menu while exploring, the replies while picking. */
export function Choices({ vn, view, onWord }: { vn: Vn; view: VnView; onWord: (w: WordId) => void }) {
  const p = view.phase;
  if (p.kind === "explore") {
    return (
      <div class="choices">
        {p.waiting.map((w) => <div key={w} class="choice waiting" aria-disabled="true">{w}</div>)}
        {p.menu.map((m, i) => (
          <button key={i} type="button" class={`choice kind-${m.kind}`} onClick={() => vn.choose(i)}>
            <span class="key">{i + 1}</span>{m.kind === "go" ? "→ " : ""}{m.label}
          </button>
        ))}
      </div>
    );
  }
  if (p.kind !== "pick") return null;
  return (
    <div class="choices">
      {p.options.map((o, i) => (
        <div key={i} class="choice reply" role="button" tabIndex={0} onClick={() => vn.choose(i)} onKeyDown={(e) => e.key === "Enter" && vn.choose(i)}>
          <span class="key">{i + 1}</span><Line line={o} onWord={onWord} />
        </div>
      ))}
    </div>
  );
}
