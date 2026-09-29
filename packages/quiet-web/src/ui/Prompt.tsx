import { useState } from "preact/hooks";
import { CONFUSED, type Quiet, type QuietView } from "../quiet";
import { ReplyLine } from "./ReplyLine";

/** What the player can do now: a name, a numbered reply, tiles, or the place's commands. */
export function Prompt({ q, view }: { q: Quiet; view: QuietView }) {
  const p = view.phase;
  const t = q.t;
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  if (p.kind === "name") {
    return (
      <form class="prompt" onSubmit={(e) => (e.preventDefault(), q.setName(name))}>
        <p class="prose">{t("name-prompt")}</p>
        <label class="cursor-line">
          <span class="cur">›</span>
          <input name="given-name" autoComplete="given-name" autoCapitalize="words" autoFocus value={name} maxLength={24} aria-label={t("name-prompt")} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button type="submit" class="dim">{t("vn-name-go")}</button>
        </label>
      </form>
    );
  }
  if (p.kind === "pick") {
    return (
      <div class="prompt">
        {p.options.map((o, i) => (
          <button key={i} type="button" class="opt" onClick={() => q.choose(i)}>
            <span class="n">{i + 1}</span>{o.text}{q.intentShown(p.options, o) && <span class="dim"> ({o.intent})</span>}
          </button>
        ))}
        {p.confused && (
          <button type="button" class="opt" onClick={() => q.choose(p.options.length)}>
            <span class="n">{p.options.length + 1}</span>{CONFUSED}<span class="dim"> ({t("reply-confused")})</span>
          </button>
        )}
        <p class="cursor-line"><span class="cur">›</span> <span class="blink">▌</span></p>
      </div>
    );
  }
  if (p.kind === "type") {
    const send = () => (q.sendText(text), setText(""));
    return (
      <div class="prompt">
        {p.confused && <p class="prose dim">{t("type-send")}</p>}
        <div class="cursor-line">
          <span class="cur">›</span>
          <ReplyLine value={text} onInput={setText} onEnter={send} placeholder={p.prompt} maxLength={60} />
          <button type="button" class="dim" aria-label={t("vn-send")} onClick={send}>↵</button>
        </div>
      </div>
    );
  }
  if (p.kind === "tiles") {
    return (
      <div class="prompt">
        <div class="tiles">
          {p.tiles.map((tile, i) => (
            <button key={i} type="button" class="tile" disabled={p.placed.includes(i)} onClick={() => q.placeTile(i)}>{tile}</button>
          ))}
          <button type="button" class="tile send" aria-label={t("vn-send")} title={t("vn-send")} disabled={!p.placed.length} onClick={() => q.sendTiles()}>✓</button>
        </div>
        <p class="cursor-line">
          <span class="cur">›</span> <span>{p.answer}</span><span class="blink">▌</span>
          <span class="spacer" />
          <button type="button" class="dim" aria-label={t("vn-undo")} disabled={!p.placed.length} onClick={() => q.undoTile()}>⌫</button>
          <button type="button" class="dim" aria-label={t("vn-send")} disabled={!p.placed.length} onClick={() => q.sendTiles()}>↵</button>
        </p>
      </div>
    );
  }
  return (
    <div class="prompt">
      {p.waiting.map((w) => <p key={w} class="prose dim">{w}</p>)}
      <div class="cmds">
        <span class="cur">›</span>
        <div class="cmd-list">
        {p.menu.map((m, i) => (
          <button key={i} type="button" class={`cmd${m.kind !== "go" && m.kind !== "sleep" && m.disabled ? " off" : ""}`} onClick={() => q.choose(i)}>
            <span class="n">{i + 1}</span>{m.label}
            {m.kind !== "go" && m.kind !== "sleep" && m.disabled && <span class="dim"> ({m.disabled})</span>}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
