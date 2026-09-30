import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { ENTER_MS, firstSentence, openingStep, paragraphDelays, type OpeningEvent, type OpeningStage } from "../opening";
import type { Quiet } from "../quiet";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;

/** The block's vertical offset its transform adds now (mid-transition), so a new glide starts from where it is. */
function shiftNow(el: HTMLElement): number {
  const tf = getComputedStyle(el).transform;
  if (!tf || tf === "none") return 0;
  try {
    return new DOMMatrixReadOnly(tf).m42;
  } catch {
    return 0;
  }
}

/** A new game on a course with the Book: the story's paragraphs come in one at a time, each given time to
 * be read, then the one name question. One thing on screen at a time; only what can be acted on pulses. */
export function Opening({ q, story }: { q: Quiet; story: string[] }) {
  const t = q.t;
  const [stage, setStage] = useState<OpeningStage>("crawl");
  const [shown, setShown] = useState(Math.min(1, story.length));
  const step = (ev: OpeningEvent) => setStage((s) => openingStep(s, ev));
  const still = matches("(prefers-reduced-motion: reduce)");
  const touch = matches("(pointer: coarse)");
  const delays = paragraphDelays(story);

  // The next paragraph once this one has been read; after the last, the prompt once it has settled. Its
  // animationend settles it too; the timer covers a hidden tab (or reduced motion), where none comes.
  useEffect(() => {
    if (stage !== "crawl") return;
    if (shown < story.length) {
      const h = setTimeout(() => setShown((n) => n + 1), delays[shown - 1] ?? 0);
      return () => clearTimeout(h);
    }
    const h = setTimeout(() => step("settled"), still ? ENTER_MS : ENTER_MS + 500);
    return () => clearTimeout(h);
  }, [stage, shown]);

  // The block stays centred as it grows: each new paragraph moves it up by half its height, and it glides
  // there from where it was instead of jumping (FLIP on the block's layout offset).
  const block = useRef<HTMLDivElement>(null);
  const lastTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = block.current;
    if (!el) return;
    const top = el.offsetTop;
    const was = lastTop.current;
    lastTop.current = top;
    if (still || was === null || was === top) return;
    const from = was - top + shiftNow(el);
    el.style.transition = "none";
    el.style.transform = `translateY(${from}px)`;
    void el.offsetHeight; // commit the start before the glide
    el.style.transition = `transform ${ENTER_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
    el.style.transform = "translateY(0)";
  }, [shown]);

  useEffect(() => {
    if (stage === "name") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      step("next");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [stage]);

  if (stage === "name") return <NameScreen q={q} />;
  return (
    <div class="opening crawl-screen" onClick={() => step("next")}>
      <div ref={block} class={`crawl${still ? "" : " moving"}`}>
        {story.slice(0, shown).map((p, i) => {
          const [head, rest] = firstSentence(p);
          const last = i === story.length - 1;
          return (
            <p key={i} style={{ animationDuration: `${ENTER_MS}ms` }}
              onAnimationEnd={last ? (e) => e.target === e.currentTarget && step("settled") : undefined}>
              <b>{head}</b>{rest}
            </p>
          );
        })}
        {stage === "ready" && <p class="go" aria-live="polite"><span class="pulse">{touch ? t("vn-tap") : t("quiet-press-enter")}</span></p>}
      </div>
    </div>
  );
}

function NameScreen({ q }: { q: Quiet }) {
  const t = q.t;
  const [name, setName] = useState("");
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const submit = (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return input.current?.focus();
    setBad(!q.setName(name.trim()));
  };
  return (
    <form class="opening name-screen" onSubmit={submit}>
      <p class="name-title">{t("quiet-name-title")}</p>
      <div class="name-row">
        <input ref={input} name="given-name" autoComplete="given-name" autoCapitalize="words" value={name} maxLength={24} aria-label={t("quiet-name-title")}
          onInput={(e) => (setName((e.target as HTMLInputElement).value), setBad(false))} />
        <button type="submit" class="go pulse">↵ {t("quiet-enter")}</button>
      </div>
      {bad && <p class="bad" role="alert">{t("reject-bad-name")}</p>}
    </form>
  );
}
