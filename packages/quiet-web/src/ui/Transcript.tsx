import { useEffect, useRef } from "preact/hooks";
import type { WordId } from "@silver-tongue/core";
import { firstTimeWords, sentenceCard, type SentenceCard, type WordCard } from "@silver-tongue/view";
import type { Beat, Quiet, QuietView } from "../quiet";
import { Line } from "./Line";

/** What is open under a line: its whole reading and meaning, or one word's card. */
export type Reveal = { beat: number; kind: "line"; card: SentenceCard } | { beat: number; kind: "word"; card: WordCard; example?: SentenceCard };

function Card({ q, reveal }: { q: Quiet; reveal: Reveal }) {
  const c = reveal.card;
  const reading = reveal.kind === "word" ? reveal.card.readings.join(" ") : reveal.card.reading;
  const meaning = reveal.kind === "word" ? reveal.card.gloss : reveal.card.meaning;
  return (
    <div class="gl card">
      <span class="conn">┆</span>{" "}
      {reveal.kind === "word" && <span class="gloss">{reveal.card.base ? `${c.text} (${reveal.card.base}) ` : `${c.text} `}</span>}
      <span class="gloss">{[reading, meaning].filter(Boolean).join(" · ")}</span>
      {c.clips.length > 0 && <button type="button" class="play" aria-label={q.t("vn-play-word")} onClick={() => q.play(c.clips)}>▶</button>}
      {reveal.kind === "word" && reveal.example && (
        <div class="dim">
          <span class="conn">┆</span> {reveal.example.text}{" "}
          <span class="gloss">{[reveal.example.reading, reveal.example.meaning].filter(Boolean).join(" · ")}</span>
        </div>
      )}
    </div>
  );
}

function Said({ q, b, reveal, onWord, onReveal }: {
  q: Quiet; b: Beat; reveal?: Reveal; onWord: (b: Beat, w: WordId, surface: string) => void; onReveal: (b: Beat) => void;
}) {
  const { t, course, core } = q;
  const now = Date.now();
  const player = b.speaker === "player";
  const who = player ? core.state.player ?? t("you") : t(`npc-${b.speaker}`);
  const fresh = new Set(b.fresh ?? []);
  const r = b.restate;
  // The request said again after a reaction glosses nothing: its new words were glossed when first said.
  const again = r ? firstTimeWords(course, r.line, new Set(r.fresh ?? [])) : [];
  const news = b.line && !player ? [...firstTimeWords(course, b.line, fresh), ...again].filter((w, i, all) => all.findIndex((x) => x.word === w.word) === i) : [];
  // A rephrased line comes with everything; any other NPC line has a ? when it has a meaning to show
  // (the request's, when the line says it again).
  const rephrased = b.rephrase || !!r?.rephrase;
  const target = r?.line ?? b.line;
  const whole = target && !player ? sentenceCard(course, target) : undefined;
  const cls = `ln ${player ? "you" : "npc"}`;
  return (
    <>
      <div class={cls}>
        <span class="who">{who}</span>
        <span class="sep">: </span>
        {b.title && <b>{b.title} </b>}
        {b.line ? (
          <Line line={b.line} fresh={b.fresh} words={player ? undefined : core.state.words} now={now} onWord={player ? undefined : (w, s) => onWord(b, w, s)} />
        ) : (
          <span class="prose-in">{b.text}</span>
        )}
        {r && (
          <span class="restate">
            <Line line={r.line} fresh={r.fresh ?? []} words={core.state.words} now={now} onWord={(w, s) => onWord(b, w, s)} />
          </span>
        )}
        {whole && !rephrased && (
          <button type="button" class="q" aria-label={t("quiet-reveal")} aria-expanded={reveal?.kind === "line"} onClick={() => onReveal(b)}>?</button>
        )}
        {rephrased && <span class="tag">{t(r?.rephrase === "slower" ? "rephrased" : "quiet-rephrase")}</span>}
        {b.cost && (
          <span class={`cost ${b.cost.reason}`}>
            {t("wallet-change", { sign: "-", amount: Math.abs(b.cost.amount), currency: course.world.currency, reason: t(`reason-${b.cost.reason}`) })}
          </span>
        )}
      </div>
      {news.map((w) => (
        <div key={w.word} class="gl">
          <span class="conn">┆</span> <span class="gloss">{`${w.text} `}{[w.reading, w.gloss].filter(Boolean).join(" · ")}</span> <span class="dim">{t("quiet-new")}</span>
        </div>
      ))}
      {rephrased && whole && (
        <div class="gl"><span class="gloss">{[whole.reading, whole.meaning].filter(Boolean).join("  · ")}</span></div>
      )}
      {reveal && <Card q={q} reveal={reveal} />}
    </>
  );
}

/** Everything said so far, newest at the bottom. */
export function Transcript({ q, view, reveal, onWord, onReveal, children }: {
  q: Quiet; view: QuietView; reveal: Reveal | null; onWord: (b: Beat, w: WordId, surface: string) => void; onReveal: (b: Beat) => void;
  children?: preact.ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = view.backlog.at(-1)?.id;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last, view.phase.kind]);
  return (
    <main class="body" ref={ref}>
      <div class="log" role="log" aria-live="polite">
        {view.backlog.map((b) => {
          const open = reveal?.beat === b.id ? reveal : undefined;
          if (b.speaker) return <Said key={b.id} q={q} b={b} reveal={open} onWord={onWord} onReveal={onReveal} />;
          return <p key={b.id} class={`prose${b.tone ? ` ${b.tone}` : ""}${b.day ? " day" : ""}`}>{b.title && <b>{b.title} </b>}{b.text}</p>;
        })}
      </div>
      {children}
    </main>
  );
}
