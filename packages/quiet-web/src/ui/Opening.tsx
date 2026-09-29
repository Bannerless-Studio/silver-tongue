import { useEffect, useRef, useState } from "preact/hooks";
import { CRAWL_MS, firstSentence, openingStep, STILL_MS, type OpeningEvent, type OpeningStage } from "../opening";
import type { Quiet } from "../quiet";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;

/** A new game on a course with the Book: the story rises and stops, then the one name question. One thing
 * on screen at a time; only what can be acted on pulses. */
export function Opening({ q, story }: { q: Quiet; story: string[] }) {
  const t = q.t;
  const [stage, setStage] = useState<OpeningStage>("crawl");
  const step = (ev: OpeningEvent) => setStage((s) => openingStep(s, ev));
  const still = matches("(prefers-reduced-motion: reduce)");
  const touch = matches("(pointer: coarse)");

  // The crawl's end is also timed, in case its animationend never comes (a hidden tab).
  useEffect(() => {
    if (stage !== "crawl") return;
    const h = setTimeout(() => step("settled"), still ? STILL_MS : CRAWL_MS + 500);
    return () => clearTimeout(h);
  }, [stage]);

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
      <div class={`crawl${still ? "" : " moving"}`} style={{ animationDuration: `${CRAWL_MS}ms` }} onAnimationEnd={() => step("settled")}>
        {story.map((p, i) => {
          const [head, rest] = firstSentence(p);
          return <p key={i}><b>{head}</b>{rest}</p>;
        })}
        {stage === "ready" && <p class="go pulse" aria-live="polite">{touch ? t("vn-tap") : t("quiet-press-enter")}</p>}
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
