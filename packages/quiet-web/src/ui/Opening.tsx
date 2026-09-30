import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { PAUSE_MS, PROMPT_MS, firstSentence, openingStep, travelMs, type OpeningEvent, type OpeningStage } from "../opening";
import type { Quiet } from "../quiet";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
const EASE_OUT = "cubic-bezier(0.15, 0.55, 0.45, 1)"; // near-constant climb, gentle settle

/** A new game on a course with the Book: each of the story's paragraphs comes up from the bottom edge of the
 * screen to its place, the next only once it has settled, then the one name question. The whole block is laid
 * out from the start (paragraphs not yet in are hidden), so it stays centred and nothing jumps. */
export function Opening({ q, story }: { q: Quiet; story: string[] }) {
  const t = q.t;
  const [stage, setStage] = useState<OpeningStage>("crawl");
  // How many paragraphs have started coming in; the last of them is the one moving.
  const [shown, setShown] = useState(story.length ? 1 : 0);
  const step = (ev: OpeningEvent) => setStage((s) => openingStep(s, ev));
  const still = matches("(prefers-reduced-motion: reduce)");
  const touch = matches("(pointer: coarse)");
  const paras = useRef<(HTMLParagraphElement | null)[]>([]);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Paragraph shown-1 travels from below the bottom edge to its place. When it arrives (animation finish, or
  // the timer when none comes: hidden tab), after a pause the next starts; after the last, the prompt.
  useLayoutEffect(() => {
    if (stage !== "crawl") return;
    if (shown === 0) return void step("settled");
    const el = paras.current[shown - 1];
    const vh = innerHeight || document.documentElement.clientHeight;
    const distance = el ? Math.max(0, vh - el.getBoundingClientRect().top) : vh;
    const ms = travelMs(distance, vh);
    let done = false;
    let after: ReturnType<typeof setTimeout> | undefined;
    // Every paragraph starts at once, so the story climbs as one block; the last one settling brings the prompt.
    const last = shown >= story.length;
    const arrive = () => {
      if (done) return;
      done = true;
      after = setTimeout(() => step("settled"), PROMPT_MS);
    };
    let anim: Animation | undefined;
    if (!still && el && typeof el.animate === "function") {
      anim = el.animate([{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: EASE_OUT, fill: "backwards" });
      if (last) anim.onfinish = arrive;
    }
    const next = last ? undefined : setTimeout(() => setShown(shown + 1), still ? PAUSE_MS : 0);
    const fallback = last ? setTimeout(arrive, still ? ms : ms + 300) : undefined;
    return () => {
      done = true;
      clearTimeout(fallback);
      clearTimeout(next);
      clearTimeout(after);
      if (stageRef.current !== "crawl") anim?.cancel();
    };
  }, [stage, shown]);

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
      <div class="crawl">
        {story.map((p, i) => {
          const [head, rest] = firstSentence(p);
          return (
            <p key={i} ref={(el) => void (paras.current[i] = el)} class={i < shown ? undefined : "waiting"} aria-hidden={i < shown ? undefined : true}>
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
