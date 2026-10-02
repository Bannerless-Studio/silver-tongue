import { useState } from "preact/hooks";
import type { RenderedLine } from "@silver-tongue/core";
import { bookOn, quietRuby, type RubySetting } from "@silver-tongue/view";
import { CONFUSED, type Quiet, type QuietView } from "../quiet";
import { Line } from "./Line";
import { ReplyLine } from "./ReplyLine";

const matches = (query: string) => typeof matchMedia === "function" && matchMedia(query).matches;

/** The tiles' one-time how (kept per course, like the look-up hint): gone once a reply has been built. */
const tilesHintKey = (course: string) => `silver-tongue:tiles-hint:${course}`;
function tilesHintDone(course: string): boolean {
  try {
    return localStorage.getItem(tilesHintKey(course)) === "1";
  } catch {
    return false;
  }
}
function finishTilesHint(course: string) {
  try {
    localStorage.setItem(tilesHintKey(course), "1");
  } catch {
    // private window: the hint shows again next time
  }
}

/** What the player can do now: a name, a numbered reply, tiles, or the place's commands. */
export function Prompt({ q, view, ruby }: { q: Quiet; view: QuietView; ruby: RubySetting }) {
  const p = view.phase;
  const t = q.t;
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const touch = matches("(pointer: coarse)");
  const book = bookOn(q.course);
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
    const now = Date.now();
    // A reply with readings to write under it is drawn as a line; the rest stay plain text.
    // While onboarding every reply shows its reading, whatever the setting: the Korean, how it sounds, what it means.
    const readingsFor = (o: RenderedLine) => {
      const spans = quietRuby(q.course, o, q.core.state.words, now, view.onboard && ruby === "off" ? "on" : ruby);
      return spans.length ? <Line line={o} now={now} ruby={spans} /> : o.text;
    };
    if (view.onboard) {
      const row = (key: number, ko: preact.ComponentChildren, meaning: string | undefined, onClick: () => void) => (
        <button key={key} type="button" class="opt onb" onClick={onClick}>
          {!touch && <span class="n">{key + 1}</span>}
          <span class="opt-body"><span class="opt-ko">{ko}</span>{meaning && <span class="opt-mean">{meaning}</span>}</span>
        </button>
      );
      return (
        <div class="prompt">
          {p.options.map((o, i) => row(i, readingsFor(o), o.meaning ?? o.intent, () => q.choose(i)))}
          {p.confused && row(p.options.length, CONFUSED, t("reply-confused"), () => q.choose(p.options.length))}
        </div>
      );
    }
    // With the Book a reply's intent sits under it, as the onboarding meaning did: beside it, a phone's
    // width squeezes the reply into a column.
    const opt = (key: number, body: preact.ComponentChildren, intent: string | undefined, onClick: () => void) =>
      book ? (
        <button key={key} type="button" class="opt" onClick={onClick}>
          {!touch && <span class="n">{key + 1}</span>}
          <span class="opt-body"><span>{body}</span>{intent && <span class="opt-mean">{intent}</span>}</span>
        </button>
      ) : (
        <button key={key} type="button" class="opt" onClick={onClick}>
          <span class="n">{key + 1}</span>{body}{intent && <span class="dim"> ({intent})</span>}
        </button>
      );
    return (
      <div class="prompt">
        {p.options.map((o, i) => opt(i, readingsFor(o), q.intentShown(p.options, o) ? o.intent : undefined, () => q.choose(i)))}
        {p.confused && opt(p.options.length, CONFUSED, t("reply-confused"), () => q.choose(p.options.length))}
        {!book && <p class="cursor-line"><span class="cur">›</span> <span class="blink">▌</span></p>}
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
    const hint = book && !tilesHintDone(q.course.id);
    const send = () => {
      if (hint) finishTilesHint(q.course.id);
      q.sendTiles();
    };
    return (
      <div class="prompt">
        {hint && <p class="hint">{t(touch ? "quiet-tiles-tap" : "quiet-tiles-click")}</p>}
        <div class="tiles">
          {p.tiles.map((tile, i) => (
            <button key={i} type="button" class="tile" disabled={p.placed.includes(i)} onClick={() => q.placeTile(i)}>{tile}</button>
          ))}
          <button type="button" class="tile send" aria-label={t("vn-send")} title={t("vn-send")} disabled={!p.placed.length} onClick={send}>✓</button>
        </div>
        <p class="cursor-line">
          <span class="cur">›</span> <span>{p.answer}</span><span class="blink">▌</span>
          <span class="spacer" />
          <button type="button" class="dim" aria-label={t("vn-undo")} disabled={!p.placed.length} onClick={() => q.undoTile()}>⌫</button>
          {!(book && touch) && <button type="button" class="dim" aria-label={t("vn-send")} disabled={!p.placed.length} onClick={send}>↵</button>}
        </p>
      </div>
    );
  }
  // With the Book: what the story wants next is the one bright control (Enter does it); anything else
  // stays on one quiet row under it.
  if (book && p.primary !== undefined) {
    const lead = p.menu[p.primary];
    const rest = p.menu.map((m, i) => ({ m, i })).filter(({ i }) => i !== p.primary);
    return (
      <div class="prompt">
        {p.waiting.map((w) => <p key={w} class="prose dim">{w}</p>)}
        <button type="button" class="next-btn only" onClick={() => q.choose(p.primary!)}>{touch ? "" : "↵ "}{lead.label}</button>
        {rest.length > 0 && (
          <div class="also">
            {rest.map(({ m, i }) => (
              <button key={i} type="button" class="dim" onClick={() => q.choose(i)}>{!touch && <span class="n">{i + 1}</span>}{m.label}</button>
            ))}
          </div>
        )}
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

/** The place's bright control on a course with the Book (see primaryItem): its index in the menu. */
export function primaryAction(book: boolean, p: QuietView["phase"]): number | undefined {
  return book && p.kind === "explore" ? p.primary : undefined;
}
