import { useEffect, useRef, useState } from "preact/hooks";
import { firstUnread, readsAs, romanize, type DeskPaper } from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import { DeskArt } from "./desk-art";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
/** After a paper's last line: how long it stays up, read, before the desk comes back. */
const PAPER_DONE_MS = 1_200;
/** The desk fading out once every paper is read. */
const FADE_MS = 900;
/** A wrong reading shakes the field this long. */
const SHAKE_MS = 400;

/** After the name screen on a book course with papers: the papers on the desk, all in the language, no meanings.
 * Each is read out by typing its lines in Latin letters; once all are read, someone knocks and the game starts. */
export function Desk({ q, papers, bookOpen, onBook }: { q: Quiet; papers: DeskPaper[]; bookOpen: boolean; onBook: () => void }) {
  const t = q.t;
  const read = q.readPapers();
  const [paper, setPaper] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<"fade" | "knock" | null>(null);
  const allRead = papers.every((p) => read.has(p.id));
  const still = matches("(prefers-reduced-motion: reduce)");
  const touch = matches("(pointer: coarse)");

  // Back on the desk with every paper read: the desk fades, then the one line.
  useEffect(() => {
    if (paper || !allRead || leaving) return;
    setLeaving("fade");
    const id = setTimeout(() => setLeaving("knock"), still ? 0 : FADE_MS);
    return () => clearTimeout(id);
  }, [paper, allRead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || bookOpen) return;
      if (leaving === "knock" && e.key === "Enter") return void (e.preventDefault(), q.leaveDesk());
      if (e.key === "Escape" && paper) return void (e.preventDefault(), setPaper(null));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  if (leaving === "knock") {
    return (
      <div class="desk-screen desk-knock" onClick={() => q.leaveDesk()}>
        <p class="knock">{t("desk-done")}</p>
        <p class="go"><span class="pulse">{touch ? t("vn-tap") : t("quiet-press-enter")}</span></p>
      </div>
    );
  }
  const open = paper ? papers.find((p) => p.id === paper) : undefined;
  if (open) return <PaperView q={q} paper={open} done={read.has(open.id)} onBook={onBook} onBack={() => setPaper(null)} />;
  const pulse = firstUnread(papers, read);
  return (
    <div class={leaving === "fade" ? "desk-screen leaving" : "desk-screen"}>
      <p class="desk-title">{t("quiet-desk-title")}</p>
      <div class="desk">
        {papers.map((p) => {
          const done = read.has(p.id);
          return (
            <button key={p.id} type="button" class={`desk-card ${done ? "read" : "unread"}${p.id === pulse ? " pulse" : ""}`} aria-label={p.lines[0]?.text} onClick={() => setPaper(p.id)}>
              <DeskArt kind={p.kind} title={p.lines[0]?.text ?? ""} lang={q.course.language.code} />
              <span class="desk-card-state">{done ? "✓" : t("quiet-desk-unread")}</span>
            </button>
          );
        })}
      </div>
      <footer class="bar">
        <button type="button" class="dim" onClick={onBook}>{t("quiet-book").toLowerCase()}</button>
      </footer>
    </div>
  );
}

/** One paper, laid out like the document; the current line is read out in the field under it. */
function PaperView({ q, paper, done, onBook, onBack }: { q: Quiet; paper: DeskPaper; done: boolean; onBook: () => void; onBack: () => void }) {
  const t = q.t;
  const [at, setAt] = useState(done ? paper.lines.length : 0);
  const [typed, setTyped] = useState("");
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [at]);
  const finished = at >= paper.lines.length;

  // The last line read: the paper stays a moment, then the desk.
  useEffect(() => {
    if (!finished || done) return;
    q.readPaper(paper.id);
    const id = setTimeout(onBack, PAPER_DONE_MS);
    return () => clearTimeout(id);
  }, [finished]);

  const submit = (e: Event) => {
    e.preventDefault();
    const line = paper.lines[at];
    if (!line || !typed.trim()) return input.current?.focus();
    if (typed.trim().toLowerCase() === "book") return (setTyped(""), onBook());
    if (readsAs(typed, line.text)) {
      q.play(line.audio ?? []);
      setTyped("");
      setAt(at + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
      input.current?.focus();
    }
  };

  return (
    <div class="desk-screen">
      <div class={`paper paper-${paper.kind}`} lang={q.course.language.code}>
        {paper.lines.map((l, i) => (
          <div key={l.id} class={`pl pl-${l.id}${i === at ? " cur" : ""}${i < at ? " said" : ""}`}>
            <button type="button" class="pl-text" disabled={i >= at} onClick={() => q.play(l.audio ?? [])}>{l.text}</button>
            {i < at && <span class="pl-rr" lang={`${q.course.language.code}-Latn`}>{romanize(l.text)}</span>}
            {i === at && (
              <form class={shake ? "read-row shake" : "read-row"} onSubmit={submit} lang={q.course.learner}>
                <label class="read-label" for="read-aloud">{t("quiet-read-aloud")}</label>
                <input id="read-aloud" ref={input} value={typed} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellcheck={false}
                  onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
                <button type="submit" class="go pulse">↵ {t("quiet-enter")}</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <footer class="bar">
        <button type="button" class="dim" onClick={onBack}>{t("quiet-esc")}</button>
        <button type="button" class="dim" onClick={onBook}>{t("quiet-book").toLowerCase()}</button>
      </footer>
    </div>
  );
}
