import { useState } from "preact/hooks";
import { typePrompt, type HintView } from "@silver-tongue/view";
import type { Vn, VnView } from "../vn";

/** A hint as a card: the nudge, the key words, or the reply. */
function Hint({ vn, h }: { vn: Vn; h: HintView }) {
  return (
    <div class={`hint hint-${h.level}`}>
      <div class="hint-title">
        {vn.t("hint-title", { level: h.level })} <span>{vn.t(`hint-level-${h.level}`)}</span>
      </div>
      {h.level === 1 && <div>{h.text}</div>}
      {h.level === 2 &&
        h.words.map((w) => (
          <div key={w.word}>
            {vn.t("hint-use")} <b>{w.text}</b> <i>{w.reading}</i> {w.gloss}
          </div>
        ))}
      {h.level === 3 && (
        <div>
          <b>{h.reply.text}</b> <i>{h.reply.reading}</i>
          <div>{h.reply.meaning}</div>
        </div>
      )}
    </div>
  );
}

/** Typing the reply: a text field, the hints asked for, and buttons for another hint and to say it. */
export function TypeReply({ vn, view }: { vn: Vn; view: VnView }) {
  const [text, setText] = useState("");
  const p = view.phase;
  if (p.kind !== "type") return null;
  const send = () => {
    vn.sendText(text);
    setText("");
  };
  return (
    <form class="type-reply" onSubmit={(e) => (e.preventDefault(), send())}>
      {p.hints.map((h) => (
        <Hint key={h.level} vn={vn} h={h} />
      ))}
      <div class="type-row">
        <input
          class="type-input"
          autoFocus
          maxLength={60}
          placeholder={typePrompt(vn.t)}
          aria-label={typePrompt(vn.t)}
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
        />
        <button type="button" class="tile tool" title={vn.t("vn-hint")} aria-label={vn.t("vn-hint")} disabled={p.hints.length >= 3} onClick={() => vn.hint()}>?</button>
        <button type="submit" class="tile tool primary" title={vn.t("vn-send")} aria-label={vn.t("vn-send")}>✓</button>
      </div>
    </form>
  );
}
