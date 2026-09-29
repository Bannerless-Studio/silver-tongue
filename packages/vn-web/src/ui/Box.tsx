import { useState } from "preact/hooks";
import type { RenderedLine, WordId } from "@silver-tongue/core";
import { rubyRow, type RubySetting } from "@silver-tongue/view";
import type { Vn, VnView } from "../vn";
import { Line } from "./Line";

/** The dialogue box: whoever speaks, what is said, and the tools to hear or understand it. */
export function Box({ vn, view, ruby, onWord, onMeaning }: { vn: Vn; view: VnView; ruby: RubySetting; onWord: (w: WordId) => void; onMeaning: () => void }) {
  const [name, setName] = useState("");
  // Worked out on each paint, so a reading fades as soon as its word is known.
  const readings = (line: RenderedLine) => rubyRow(vn.course, line, vn.core.state.words, Date.now(), ruby);
  const p = view.phase;
  const who = (speaker?: string) => (speaker === "player" ? vn.core.state.player ?? vn.t("you") : speaker ? vn.t(`npc-${speaker}`) : undefined);
  const tools = (line?: { audio?: string[]; meaning?: string }) => (
    <span class="box-tools">
      {line?.audio?.length ? <button type="button" title={vn.t("vn-replay")} aria-label={vn.t("vn-replay")} onClick={(e) => (e.stopPropagation(), vn.replay())}>▶</button> : null}
      {line?.audio?.length ? <button type="button" title={vn.t("vn-slow")} aria-label={vn.t("vn-slow")} onClick={(e) => (e.stopPropagation(), vn.replay(true))}>🐢</button> : null}
      {view.lastLine?.meaning ? <button type="button" title={vn.t("vn-meaning")} aria-label={vn.t("vn-meaning")} onClick={(e) => (e.stopPropagation(), onMeaning())}>?</button> : null}
    </span>
  );

  if (p.kind === "name") {
    return (
      <form class="box" onSubmit={(e) => (e.preventDefault(), vn.setName(name))}>
        <div class="nameplate">{vn.t("name-prompt")}</div>
        <input class="name-input" name="given-name" autoComplete="given-name" autoCapitalize="words" autoFocus maxLength={20} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <button type="submit" class="primary">{vn.t("vn-name-go")}</button>
      </form>
    );
  }
  if (p.kind === "beat") {
    const b = p.beat;
    return (
      <div class={`box tone-${b.tone ?? "plain"}${b.speaker ? "" : " narration"}`} onClick={() => vn.advance()} role="button" aria-label={vn.t("vn-tap")}>
        {(b.title || who(b.speaker)) && <div class="nameplate">{b.title ?? who(b.speaker)}</div>}
        <div class="box-text">{b.line ? <Line line={b.line} fresh={b.fresh} ruby={b.speaker && b.speaker !== "player" ? readings(b.line) : undefined} onWord={b.speaker === "player" ? undefined : onWord} /> : b.text}</div>
        {tools(b.line)}
        <span class="next" aria-hidden="true">▼</span>
      </div>
    );
  }
  if (p.kind === "explore") {
    return (
      <div class="box narration">
        <div class="nameplate">{vn.t(`place-${view.place}`)}</div>
        <div class="box-text">{vn.t(`place-${view.place}-desc`)}</div>
      </div>
    );
  }
  // pick or tiles: the line being answered stays up, words and all
  const answer = p.kind === "tiles" ? p.answer : "";
  return (
    <div class="box">
      {view.npc && <div class="nameplate">{who(view.npc)}</div>}
      <div class="box-text">{view.lastLine && <Line line={view.lastLine} ruby={readings(view.lastLine)} onWord={onWord} />}</div>
      {p.kind === "tiles" && <div class="answer">{vn.t("tiles-answer")} <b>{answer}</b></div>}
      {tools(view.lastLine)}
    </div>
  );
}
