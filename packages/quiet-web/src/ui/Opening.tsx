import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { PROMPT_MS, firstSentence, openingStep, travelMs, type OpeningEvent, type OpeningStage } from "../opening";
import type { Quiet } from "../quiet";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
const EASE_OUT = "cubic-bezier(0.15, 0.55, 0.45, 1)"; // near-constant climb, gentle settle

/** A new game on a course with the Book: the story's paragraphs come up from the bottom edge of the screen as one
 * block to their place and settle, then the one name question. */
export function Opening({ q, story }: { q: Quiet; story: string[] }) {
  const t = q.t;
  const [stage, setStage] = useState<OpeningStage>("crawl");
  const step = (ev: OpeningEvent) => setStage((s) => openingStep(s, ev));
  const still = matches("(prefers-reduced-motion: reduce)");
  const touch = matches("(pointer: coarse)");
  const block = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // The block travels from below the bottom edge to its place. When it arrives (animation finish, or the timer
  // when none comes: hidden tab), after a short pause the prompt shows.
  useLayoutEffect(() => {
    if (stage !== "crawl") return;
    if (!story.length) return void step("settled");
    const el = block.current;
    const vh = innerHeight || document.documentElement.clientHeight;
    const distance = el ? Math.max(0, vh - el.getBoundingClientRect().top) : vh;
    const ms = travelMs(distance, vh);
    let done = false;
    let after: ReturnType<typeof setTimeout> | undefined;
    const arrive = () => {
      if (done) return;
      done = true;
      after = setTimeout(() => step("settled"), PROMPT_MS);
    };
    let anim: Animation | undefined;
    if (!still && el && typeof el.animate === "function") {
      anim = el.animate([{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: EASE_OUT, fill: "backwards" });
      anim.onfinish = arrive;
    }
    const fallback = setTimeout(arrive, still ? 0 : ms + 300);
    return () => {
      done = true;
      clearTimeout(fallback);
      clearTimeout(after);
      if (stageRef.current !== "crawl") anim?.cancel();
    };
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
      <div class="crawl" ref={block}>
        {story.map((p, i) => {
          const [head, rest] = firstSentence(p);
          return (
            <p key={i}>
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
