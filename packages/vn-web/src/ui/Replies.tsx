import type { WordId } from "@silver-tongue/core";
import { rubyRow, type RubySetting } from "@silver-tongue/view";
import type { Vn, VnView } from "../vn";
import { Line } from "./Line";

/** What you can say back: one big card per reply, its words tappable for help. */
export function Replies({ vn, view, ruby, onWord }: { vn: Vn; view: VnView; ruby: RubySetting; onWord: (w: WordId) => void }) {
  if (view.phase.kind !== "pick") return null;
  const now = Date.now();
  return (
    <div class="replies">
      {view.phase.options.map((o, i) => (
        <div key={i} class="reply-card" role="button" tabIndex={0} onClick={() => vn.choose(i)} onKeyDown={(e) => e.key === "Enter" && vn.choose(i)}>
          <span class="key">{i + 1}</span><Line line={o} ruby={rubyRow(vn.course, o, vn.core.state.words, now, ruby)} onWord={onWord} />
        </div>
      ))}
    </div>
  );
}
