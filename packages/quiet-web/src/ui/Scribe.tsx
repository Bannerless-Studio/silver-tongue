import { useEffect, useRef, useState } from "preact/hooks";
import type { RenderedLine, WordId } from "@silver-tongue/core";
import { displayGloss, freshOnReply, freshOnTheirLine, lineMeaning, meaningMatches, romanLine, romanSegments, scribeAccepts, scribeScene, scribeReplyId, soundedTokens, scribeHelpAfter, scribeShowsExample } from "@silver-tongue/view";
import { Line } from "./Line";
import type { Quiet, QuietView } from "../quiet";
import { replyOrder, type Exchange } from "../stage";
import { resolveScribeReply, freshOnce, scribeRound, subscribeRounds, updateRound, type Round } from "../scribe";

/*
 * Scribe mode (lab only, the first conversations): their line in Latin letters with a field for what it means, your
 * replies as Korean slips, with direct selection at the door and a meaning field afterwards. Wrong tries shake the field; its help
 * button lights after a few and then gives the words, then the meaning. Rules and wording: view/src/scribe.ts.
 */

const SHAKE_MS = 400;

/** The round of an exchange, redrawn when it changes. */
export function useRound(q: Quiet, ex: Exchange | undefined): Round | undefined {
  const [, tick] = useState(0);
  useEffect(() => subscribeRounds(() => tick((n) => n + 1)), []);
  return ex ? scribeRound(q, q.course.id, ex.line.id) : undefined;
}

/** A field that takes a typed meaning; a wrong try shakes it. `?` typed asks for help, as on the desk. */
function Field({ placeholder, onTry, onHelp, hot, helpLabel, children }: {
  placeholder: string; onTry: (typed: string) => boolean; onHelp: () => void; hot: boolean; helpLabel: string; children?: preact.ComponentChildren;
}) {
  const [typed, setTyped] = useState("");
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (e: Event) => {
    e.preventDefault();
    const v = typed.trim();
    if (!v) return input.current?.focus();
    if (onTry(v)) return setTyped("");
    setShake(true);
    setTimeout(() => setShake(false), SHAKE_MS);
    input.current?.focus();
  };
  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    if (v.includes("?")) onHelp();
    setTyped(v.replace(/\?/g, ""));
  };
  return (
    <div class="scribe-field">
      <form class={shake ? "scribe-form shake" : "scribe-form"} onSubmit={submit}>
        <input ref={input} value={typed} placeholder={placeholder} aria-label={placeholder} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellcheck={false} enterkeyhint="go" onInput={onInput} />
        <button type="submit" class="go" aria-label="↵">↵</button>
      </form>
      {children}
      <div class="read-tools">
        <button type="button" class={hot ? "help hot" : "help"} onClick={() => (onHelp(), input.current?.focus())}>? {helpLabel}</button>
      </div>
    </div>
  );
}

/**
 * Their Korean line and its romanisation, with tappable words and a field for its meaning; once typed
 * right the meaning stays under the line. The shared Line preserves recognised-name highlighting.
 */
export function ScribeTheir({ q, ex, held, onWord, children }: {
  q: Quiet; ex: Exchange; held: boolean; onWord: (w: WordId, surface: string, el: HTMLElement) => void; children?: preact.ComponentChildren;
}) {
  const { t, course } = q;
  const round = useRound(q, ex)!;
  const line = ex.shown;
  const meaning = lineMeaning(line);
  const solved = round.solved || !meaning;
  const segs = romanSegments(line);
  const run = q.core.state.run!;
  const source = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].id;
  const accepts = scribeAccepts(course, run.scene, source, q.core.state.player);
  const sounded = soundedTokens(course, q.readPapers(), line);
  const glosses = scribeScene(q.course, run.scene)?.glosses || (!solved && round.help >= 1);
  // Help first, hands off later: a word never met shows its gloss, a met one only when help asks.
  const fresh = freshOnce(q, `${course.id}:${ex.line.id}:line`, () => freshOnTheirLine(ex.shown, q.core.state.words, ex.line.line ?? ex.shown));
  const set = (change: Partial<Round>) => updateRound(q, course.id, ex.line.id, change);
  const onTry = (typed: string) => {
    if (meaningMatches(typed, meaning, accepts)) return set({ solved: true }), true;
    set({ misses: round.misses + 1 });
    return false;
  };
  const latin = `${course.language.code}-Latn`;
  return (
    <>
      <div class={`say scribe-say${ex.again ? " again" : " enter"}`} key={`${ex.line.id}:${ex.again}`}>
        <p class="say-text" lang={course.language.locale}><Line line={line} now={Date.now()} book sounded={sounded} onWord={onWord} /></p>
        <span class="say-text roman" lang={latin}>
          {segs.map((s, i) =>
            s.word === undefined ? (
              <span key={i}>{s.text}</span>
            ) : (
              <span key={i} class="sw">
                <button type="button" class={`w${s.token !== undefined && sounded.has(s.token) ? " sounded" : ""}`} onClick={(e) => (e.stopPropagation(), onWord(s.word!, s.surface ?? s.text, e.currentTarget))}>{s.text}</button>
                {(glosses || fresh.has(s.word)) && <span class="sw-g">{displayGloss(course.words[s.word])}</span>}
              </span>
            ),
          )}
        </span>
      </div>
      {solved ? (
        meaning && <p class="say-mean">{meaning}</p>
      ) : (
        !held && (
          <Field placeholder={t(scribeScene(q.course, run.scene)?.prompt ?? "quiet-scribe-hear")} onTry={onTry} hot={round.misses >= scribeHelpAfter(round.index)} helpLabel={t("quiet-read-help")}
            onHelp={() => set({ help: Math.min(2, round.help + 1) as Round["help"] })}>
            {scribeShowsExample(round.index) && <p class="example">{t("quiet-scribe-example", { line: romanLine(line), meaning })}</p>}
            {round.help >= 2 && <p class="rh-full">{t("quiet-scribe-full", { meaning })}</p>}
          </Field>
        )
      )}
      {children}
    </>
  );
}

/** While a scribe exchange is on stage the number keys never say a reply: typing is the one way to say. */
export function ScribeKeys({ held = false }: { held?: boolean }) {
  useEffect(() => {
    const guard = (e: KeyboardEvent) => {
      // A held moment moves on with any key (App's skip), and an open overlay keeps its own keys.
      if (held || document.querySelector('[role="dialog"]')) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!/^[1-9]$/.test(e.key.normalize("NFKC"))) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      document.querySelector<HTMLInputElement>(".scribe-field input")?.focus();
    };
    addEventListener("keydown", guard, true);
    return () => removeEventListener("keydown", guard, true);
  }, [held]);
  return null;
}

/** The meaning of each option, for matching and for the help: its own meaning, never its intent. */
const meaningOf = (o: RenderedLine): string => lineMeaning(o);

/**
 * Korean reply slips with romanisation. Select a slip at the door; later type its meaning or choose tied slips.
 * Shown once their line has been understood.
 */
export function ScribeSlips({ q, view, ex }: { q: Quiet; view: QuietView; ex?: Exchange }) {
  const { t } = q;
  const round = useRound(q, ex);
  const p = view.phase;
  if (p.kind !== "pick" || !ex || !round) return null;
  if (!round.solved && lineMeaning(ex.shown)) return null;
  const run = q.core.state.run!;
  const source = q.course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].id;
  const accepts = (o: RenderedLine) => scribeAccepts(q.course, run.scene, scribeReplyId(q.course, run.scene, source, o, q.core.state.player), q.core.state.player);
  const ties = round.ties;
  const setTies = (ties: number[]) => updateRound(q, q.course.id, ex.line.id, { ties });
  const order = replyOrder(p.options, ex.missed);
  const set = (change: Partial<Round>) => updateRound(q, q.course.id, ex.line.id, change);
  const onTry = (typed: string) => {
    const match = resolveScribeReply(typed, order.map((i) => ({ meaning: meaningOf(p.options[i]), accepts: accepts(p.options[i]) })));
    if (match.kind === "miss") return setTies([]), set({ rMisses: round.rMisses + 1 }), false;
    if (match.kind === "choose") return setTies(match.indices.map((i) => order[i])), true;
    setTies([]);
    q.choose(order[match.index]);
    return true;
  };
  const tried = new Set(ex.missed.map((m) => m.line?.text));
  const fresh = freshOnce(q, `${q.course.id}:${ex.line.id}:reply`, () => new Set(p.options.flatMap((o) => [...freshOnReply(o, q.core.state.words)])));
  return (
    <div class="slips scribe-slips">
      <div class="scribe-list" role="list">
        {order.map((i) => {
          const o = p.options[i];
          const content = <>
            <span class="slip-text" lang={q.course.language.locale}>{o.text}</span>
            <span class="slip-text" lang={`${q.course.language.code}-Latn`}>
              {romanSegments(o).map((sg, k) =>
                sg.word !== undefined && (scribeScene(q.course, run.scene)?.glosses || fresh.has(sg.word)) ? (
                  <span key={k} class="sw"><span>{sg.text}</span><span class="sw-g">{displayGloss(q.course.words[sg.word])}</span></span>
                ) : (
                  <span key={k}>{sg.text}</span>
                ),
              )}
            </span>
            {(round.rHelp || scribeScene(q.course, run.scene)?.glosses) && <span class="slip-mean">{meaningOf(o)}</span>}
            {scribeScene(q.course, run.scene)?.glosses && <span class="slip-mean">{o.intent}</span>}
          </>;
          const cls = `slip scribe-slip${tried.has(o.text) ? " tried" : ""}`;
          return scribeScene(q.course, run.scene)?.select ? (
            <div key={i} role="listitem"><button type="button" class={`${cls} selectable`} onClick={() => q.choose(i)}>{content}</button></div>
          ) : (
            <div key={i} role="listitem" tabIndex={0} class={cls}>{content}</div>
          );
        })}
      </div>
      {!scribeScene(q.course, run.scene)?.select && (ties.length ? (
        <div role="group" aria-label={t("quiet-scribe-choose")}>
          <p>{t("quiet-scribe-choose")}</p>
          {ties.map((i) => <button type="button" class="slip" onClick={() => { setTies([]); q.choose(i); }}>{p.options[i].text} · {p.options[i].intent ?? meaningOf(p.options[i])}</button>)}
        </div>
      ) : <Field placeholder={t("quiet-scribe-say")} onTry={onTry} hot={round.rMisses >= scribeHelpAfter(round.index)} helpLabel={t("quiet-read-help")} onHelp={() => set({ rHelp: true })} />)}
      {p.confused && (
        <button type="button" class="say-nothing" onClick={() => q.choose(p.options.length)}>… {t("quiet-say-nothing")}</button>
      )}
    </div>
  );
}
