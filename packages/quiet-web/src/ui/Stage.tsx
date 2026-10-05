import { pageStorage } from "../storage";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RenderedLine, WordId } from "@silver-tongue/core";
import { npcLabel, quietRuby, replyMeanings, romanLine, sentenceCard, soundedTokens, speakerHue, speakerNamed, type RubySetting, type SentenceCard } from "@silver-tongue/view";
import { CONFUSED, type Beat, type Quiet, type QuietView } from "../quiet";
import { replyOrder, stageView, type Exchange, type HistoryRow, type StageView } from "../stage";
import { scribeOn } from "../scribe";
import { Line } from "./Line";
import { ScribeKeys, ScribeSlips, ScribeTheir } from "./Scribe";
import type { Reveal } from "./Transcript";

/*
 * The conversation stage of a course with the Book (spec 2026-09-29 section 12): their line on stage,
 * your replies as paper slips from your book, everything earlier small in history above.
 */

const matches = (query: string) => typeof matchMedia === "function" && matchMedia(query).matches;
/** How long your said line stays under their line before their answer takes the stage. */
export const PICKED_MS = 1100;
/** How long a scene's opening direction stands alone before the first line comes in. */
export const INTRO_MS = 1200;

/** What the stage shows now: the live split, or a moment held back (a reply just said, a scene just opened). */
export interface Shown {
  view: StageView;
  /** the exchange on stage */
  ex?: Exchange;
  history: HistoryRow[];
  /** "picked": the reply just said, before their answer; "intro": a scene's opening direction alone */
  hold?: "picked" | "intro";
}

/** The stage as shown, holding back a moment after a reply and when a scene opens; skip() ends a hold. */
export function useStage(view: QuietView): { shown: Shown; skip: () => void } {
  const live = useMemo(() => stageView(view.backlog, view.stageFrom), [view.backlog, view.stageFrom]);
  const n = live.exchanges.length;
  const key = `${view.stageFrom ?? "-"}:${n}`;
  const prev = useRef<{ key: string; n: number; from?: number } | null>(null);
  const hold = useRef<{ key: string; kind: "picked" | "intro"; until: number } | null>(null);
  const [, tick] = useState(0);
  const p = prev.current;
  if (p && p.key !== key) {
    hold.current = null;
    if (p.from === view.stageFrom && n > p.n && live.exchanges[n - 2]?.said) hold.current = { key, kind: "picked", until: Date.now() + PICKED_MS };
    else if (view.stageFrom !== undefined && p.from !== view.stageFrom && n === 1 && live.exchanges[0].direction.length) hold.current = { key, kind: "intro", until: Date.now() + INTRO_MS };
  }
  prev.current = { key, n, from: view.stageFrom };
  const h = hold.current && hold.current.key === key && Date.now() < hold.current.until ? hold.current : null;
  useEffect(() => {
    if (!h) return;
    const timer = setTimeout(() => tick((x) => x + 1), Math.max(0, h.until - Date.now()));
    return () => clearTimeout(timer);
  }, [h?.key, h?.kind]);
  const skip = () => {
    if (!h) return;
    hold.current = null;
    tick((x) => x + 1);
  };
  if (h?.kind === "picked") {
    const at = n - 2;
    return { shown: { view: live, ex: live.exchanges[at], history: live.history.filter((r) => r.ex === undefined || r.ex < at), hold: "picked" }, skip };
  }
  if (h?.kind === "intro") return { shown: { view: live, ex: live.exchanges[0], history: live.history, hold: "intro" }, skip };
  return { shown: { view: live, ex: live.exchanges.at(-1), history: live.history }, skip };
}

/** A speaker's colour class (see speakerHue). */
const hue = (q: Quiet, b: Beat) => `hue-${speakerHue(q.course, b.speaker ?? "")}`;

/** Earlier utterances, one line each, newest at the foot. A tap opens a line's reading and meaning and says it again. */
export function History({ q, rows }: { q: Quiet; rows: HistoryRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ id: number; card: SentenceCard } | null>(null);
  const last = rows.at(-1)?.beat.id;
  const roman = scribeOn(q.view(), q.course);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last, rows.length]);
  const toggle = (b: Beat) => {
    if (open?.id === b.id) return setOpen(null);
    const card = b.line && q.sentence(b.line);
    setOpen(card ? { id: b.id, card } : null);
  };
  return (
    <div class="history" ref={ref} role="log" aria-live="off">
      {rows.map(({ beat: b }) => {
        if (b.line && b.speaker) {
          const mine = b.speaker === "player";
          const card = open?.id === b.id ? open.card : undefined;
          return (
            <div key={b.id} class={`h-row ${mine ? "h-mine" : `h-their ${hue(q, b)}`}`}>
              <button type="button" class="h-say" lang={q.course.language.locale} aria-expanded={!!card} onClick={() => toggle(b)}>{roman ? romanLine(b.line) : b.line.text}</button>
              {card && <p class="h-open">{[card.reading, card.meaning].filter(Boolean).join(" · ")}</p>}
            </div>
          );
        }
        return <p key={b.id} class={`h-note${b.tone ? ` ${b.tone}` : ""}${b.day ? " day" : ""}`}>{b.title && <b>{b.title} </b>}{b.text}</p>;
      })}
    </div>
  );
}

/** A stage direction: small, centred, upright. */
function Direction({ beats }: { beats: Beat[] }) {
  return (
    <>
      {beats.map((b) => <p key={b.id} class={`direction${b.tone ? ` ${b.tone}` : ""}`}>{b.title && <b>{b.title} </b>}{b.text}</p>)}
    </>
  );
}

/** The word card: a small paper card under the word, closed by any tap elsewhere. */
function WordPaper({ q, reveal, at, onClose }: { q: Quiet; reveal: Extract<Reveal, { kind: "word" }>; at: { x: number; y: number }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(at.x);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !box) return;
    setLeft(Math.max(0, Math.min(at.x, box.clientWidth - el.offsetWidth)));
  }, [at.x, reveal.card.word]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".word-paper, button.w")) return;
      onClose();
    };
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [onClose]);
  const c = reveal.card;
  return (
    <div class="word-paper" ref={ref} style={{ left: `${left}px`, top: `${at.y}px` }} role="dialog" aria-label={c.text}>
      <p class="wp-word" lang={q.course.language.locale}>{c.base ? `${c.text} (${c.base})` : c.text}</p>
      {c.readings.length > 0 && <p class="wp-reading">{c.readings.join(" ")}</p>}
      <p class="wp-mean">{c.gloss}</p>
      {c.clips.length > 0 && <button type="button" class="wp-play" aria-label={q.t("vn-play-word")} onClick={() => q.play(c.clips)}>▶</button>}
    </div>
  );
}

/** Your line, said: paper, compact, on your side. `building`: the sentence being put together from tiles. */
function Said({ q, b, roman }: { q: Quiet; b: Beat; roman: boolean }) {
  const { t, course } = q;
  return (
    <div class="said-row">
      <p class="said" lang={q.course.language.locale}>
        {b.line ? (roman ? romanLine(b.line) : b.line.text) : b.text === CONFUSED ? "…" : b.text}
        {b.cost && (
          <span class={`cost ${b.cost.reason}`}>
            {t("wallet-change", { sign: "-", amount: Math.abs(b.cost.amount), currency: course.world.currency, reason: t(`reason-${b.cost.reason}`) })}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * The stage: a direction, then their line large (name, readings, meaning while onboarding), your said line
 * under it, their reaction to a miss. Between scenes and while a scene opens, the direction alone.
 */
export function Stage({ q, view, shown, ruby, reveal, onWord, onReveal, onClose, children }: {
  q: Quiet; view: QuietView; shown: Shown; ruby: RubySetting; reveal: Reveal | null;
  onWord: (b: Beat, w: WordId, surface: string) => void; onReveal: (b: Beat) => void; onClose: () => void; children?: preact.ComponentChildren;
}) {
  const { t, course, core } = q;
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const ex = shown.ex;
  const named = useMemo(() => {
    const flags = speakerNamed(course, view.backlog);
    return new Map(view.backlog.map((b, i) => [b.id, flags[i]]));
  }, [view.backlog]);
  if (!ex) {
    return (
      <section class="stage-now loose" ref={ref}>
        <Direction beats={shown.view.direction} />
        {children}
      </section>
    );
  }
  // A scene opening: its direction alone where it will stay, the line still to come.
  if (shown.hold === "intro") {
    return (
      <section class="stage-now" ref={ref}>
        <div class="direction-row"><Direction beats={ex.direction.slice(-1)} /></div>
      </section>
    );
  }
  const now = Date.now();
  const b = ex.current;
  // The lab's scribe mode (see Scribe.tsx): their line in Latin letters, its meaning typed. Off everywhere else.
  const scribe = scribeOn(view, course);
  const word = (w: WordId, s: string, el: HTMLElement) => {
    const box = ref.current?.getBoundingClientRect();
    // Under the word's reading, when it has one: the card never covers it.
    const r = el.getBoundingClientRect();
    const under = el.closest("ruby")?.querySelector("rt")?.getBoundingClientRect().bottom ?? r.bottom;
    if (box) setAt({ x: r.left - box.left, y: Math.max(r.bottom, under) - box.top + 6 });
    onWord(b, w, s);
  };
  const whole = sentenceCard(course, ex.shown);
  const rephrased = ex.repeat === "rephrase" || !!b.restate?.rephrase || (!!b.rephrase && !b.slow);
  // Said while onboarding (see onboarding): the meaning starts open under the line; a tap on the line closes it.
  const auto = !!whole && !rephrased && !!b.onboard;
  const lineOpen = reveal?.kind === "line" && reveal.beat === b.id;
  const meaningShown = auto ? !lineOpen : lineOpen;
  const ask = !!whole && !rephrased && !auto;
  const sounded = soundedTokens(course, q.readPapers(), ex.shown);
  const wordOpen = reveal?.kind === "word" && reveal.beat === b.id && at ? reveal : undefined;
  const missed = !!ex.said && ex.missed.includes(ex.said);
  const tag = ex.again > 0 ? t(ex.repeat === "rephrase" ? "quiet-again" : "quiet-again-slower") : undefined;
  const spans = quietRuby(course, ex.shown, core.state.words, now, ruby);
  // The whole reading goes under the line only when the line carries none of its own: said twice it is noise.
  const readAll = !spans.length;
  return (
    <section class="stage-now" ref={ref}>
      <div class="direction-row">{shown.hold !== "picked" && <Direction beats={ex.direction.slice(-1)} />}</div>
      <div class={`their ${hue(q, ex.line)}`}>
        <p class="who">
          {named.get(ex.line.id) && <span>{npcLabel(course, core.state, t, ex.line.speaker!)}</span>}
          {tag && <span class="tag" key={ex.again}>{tag}</span>}
        </p>
        {scribe ? (
          <>
            <ScribeKeys held={!!shown.hold} />
            <ScribeTheir q={q} ex={ex} held={!!shown.hold} onWord={word}>
              {view.lookupHint === ex.line.id && <p class="hint">{t(matches("(pointer: coarse)") ? "quiet-lookup-tap" : "quiet-lookup-click")}</p>}
            </ScribeTheir>
          </>
        ) : (
          <>
          <div class={`say${ex.again ? " again" : " enter"}`} key={`${ex.line.id}:${ex.again}`} onClick={auto ? () => onReveal(b) : undefined}>
            <span class="say-text" lang={q.course.language.locale}>
              <Line line={ex.shown} words={core.state.words} now={now} book sounded={sounded} ruby={spans} onWord={word} />
            </span>
            {ask && (
              <button type="button" class="q" aria-label={t("quiet-reveal")} aria-expanded={lineOpen} onClick={(e) => (e.stopPropagation(), onReveal(b))}>?</button>
            )}
          </div>
          {(meaningShown || rephrased) && whole && (
            <p class="say-mean">{[readAll ? whole.reading : "", whole.meaning].filter(Boolean).join(" · ")}</p>
          )}
          {view.lookupHint === ex.line.id && <p class="hint">{t(matches("(pointer: coarse)") ? "quiet-lookup-tap" : "quiet-lookup-click")}</p>}
          </>
        )}
      </div>
      {ex.said && <Said q={q} b={ex.said} roman={scribe} />}
      {missed && ex.reaction?.line && (
        <div class={`their reaction ${hue(q, ex.reaction)}`}>
          <p class="say-text" lang={q.course.language.locale}>{scribe ? romanLine(ex.reaction.line) : ex.reaction.line.text}</p>
        </div>
      )}
      {children}
      {wordOpen && at && <WordPaper q={q} reveal={wordOpen} at={at} onClose={onClose} />}
    </section>
  );
}

/** The reply slips: paper from your book, one column on your side; missed replies faded and last. */
export function Slips({ q, view, ex, ruby, touch }: { q: Quiet; view: QuietView; ex?: Exchange; ruby: RubySetting; touch: boolean }) {
  const p = view.phase;
  if (p.kind !== "pick") return null;
  if (scribeOn(view, q.course)) return <ScribeSlips q={q} view={view} ex={ex} />;
  const { course, core, t } = q;
  const now = Date.now();
  const order = replyOrder(p.options, ex?.missed ?? []);
  const tried = new Set((ex?.missed ?? []).map((m) => m.line?.text));
  const meanings = replyMeanings(p.options, core.state.words, now, view.onboard, (ex?.missed.length ?? 0) > 0);
  // While onboarding every reply shows its reading, whatever the setting. A reply that needs any reading
  // gets all of it, by word group as the line on stage has it.
  const reading = (o: RenderedLine) =>
    quietRuby(course, o, core.state.words, now, view.onboard && ruby === "off" ? "on" : ruby).length
      ? quietRuby(course, o, core.state.words, now, "on").map((r) => r.text).join(" ")
      : undefined;
  const readings = p.options.map(reading);
  const anyReading = readings.some(Boolean);
  return (
    <div class="slips">
      {order.map((i, pos) => {
        const o = p.options[i];
        return (
          <button key={o.text} type="button" class={`slip${tried.has(o.text) ? " tried" : ""}`} onClick={() => q.choose(i)}>
            {!touch && <span class="slip-n" aria-hidden="true">{pos + 1}</span>}
            <span class="slip-text" lang={q.course.language.locale}>{o.text}</span>
            {anyReading && <span class="slip-rd">{readings[i] ?? " "}</span>}
            {meanings && <span class="slip-mean">{meanings[i]}</span>}
          </button>
        );
      })}
      {p.confused && (
        <button type="button" class="say-nothing" onClick={() => q.choose(p.options.length)}>
          {!touch && <span class="slip-n" aria-hidden="true">{order.length + 1}</span>}… {t("quiet-say-nothing")}
        </button>
      )}
    </div>
  );
}

/** The slip order the number keys follow on a course with the Book: key n says option slipChoice(n). */
export function slipChoice(view: QuietView, ex: Exchange | undefined, n: number): number {
  const p = view.phase;
  if (p.kind !== "pick") return n;
  const order = replyOrder(p.options, ex?.missed ?? []);
  return n < order.length ? order[n] : n;
}

/** The one-time how for tiles (kept per course, like the look-up hint): gone once a reply has been built. */
const tilesHintKey = (course: string) => `silver-tongue:tiles-hint:${course}`;
export function tilesHintDone(course: string): boolean {
  try {
    return pageStorage().getItem(tilesHintKey(course)) === "1";
  } catch {
    return false;
  }
}
export function finishTilesHint(course: string) {
  try {
    pageStorage().setItem(tilesHintKey(course), "1");
  } catch {
    // private window: the hint shows again next time
  }
}

/** The sentence being built from tiles, where your said line goes, with ⌫ and ✓ beside it. */
export function Building({ q, view, touch }: { q: Quiet; view: QuietView; touch: boolean }) {
  const p = view.phase;
  if (p.kind !== "tiles") return null;
  const t = q.t;
  const send = () => {
    finishTilesHint(q.course.id);
    q.sendTiles();
  };
  return (
    <div class="said-row building">
      <button type="button" class="bt undo" aria-label={t("vn-undo")} title={t("vn-undo")} disabled={!p.placed.length} onClick={() => q.undoTile()}>⌫</button>
      <p class={`said${p.placed.length ? "" : " empty"}`} lang={q.course.language.locale}>{p.answer || " "}</p>
      <button type="button" class="bt send" aria-label={t("vn-send")} title={touch ? undefined : `${t("vn-send")} (Enter)`} disabled={!p.placed.length} onClick={send}>✓</button>
    </div>
  );
}

/** Tile pieces: paper, on your side; the one-time hint over the row, aligned with it. */
export function Pieces({ q, view, touch }: { q: Quiet; view: QuietView; touch: boolean }) {
  const p = view.phase;
  if (p.kind !== "tiles") return null;
  const hint = !tilesHintDone(q.course.id);
  return (
    <div class="pieces">
      {hint && <p class="hint">{q.t(touch ? "quiet-tiles-tap" : "quiet-tiles-click")}</p>}
      <div class="tiles">
        {p.tiles.map((tile, i) => (
          <button key={i} type="button" class="tile piece" lang={q.course.language.locale} disabled={p.placed.includes(i)} onClick={() => q.placeTile(i)}>
            {!touch && <span class="slip-n" aria-hidden="true">{i + 1}</span>}{tile}
          </button>
        ))}
      </div>
    </div>
  );
}
