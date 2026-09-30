import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { firstUnread, letterChart, lineRead, panelView, paperSyllables, readsSyllable, romanize, syllableLetters, type DeskPaper, type PanelTile } from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import { DeskArt } from "./desk-art";

const matches = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
/** After a paper's last syllable: how long it stays up, read, before the desk comes back. */
const PAPER_DONE_MS = 1_200;
/** The desk fading out once every paper is read. */
const FADE_MS = 900;
/** A wrong reading shakes the field this long. */
const SHAKE_MS = 400;
/** The syllable taken out of the card moves to its big copy this long. */
const TAKE_MS = 300;
/** Wrong tries on one syllable before the help button gets bright. */
const HELP_AFTER = 3;

/** After the name screen on a book course with papers: the papers on the desk, all in the language, no meanings.
 * Each is read out one syllable at a time, typing its reading in Latin letters; once all are read, someone knocks
 * and the game starts. */
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
  if (open) return <PaperView q={q} paper={open} done={read.has(open.id)} bookOpen={bookOpen} onBook={onBook} onBack={() => setPaper(null)} />;
  // One card is bright: the next to read, labelled. The rest are dimmed; a read one says so. All stay tappable.
  const next = firstUnread(papers, read);
  return (
    <div class={leaving === "fade" ? "desk-screen leaving" : "desk-screen"}>
      <p class="desk-title">{t("quiet-desk-title")}</p>
      <div class="desk">
        {papers.map((p) => {
          const done = read.has(p.id);
          return (
            <button key={p.id} type="button" class={`desk-card ${done ? "read" : p.id === next ? "next" : "later"}`} aria-label={p.lines[0]?.text} onClick={() => setPaper(p.id)}>
              <DeskArt kind={p.kind} title={p.lines[0]?.text ?? ""} lang={q.course.language.code} />
              <span class="desk-card-state">{done ? t("quiet-desk-done") : p.id === next ? t("quiet-desk-read") : " "}</span>
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

/** One tile of the letter panel: the letter, its sound; tap it to hear it. */
function Tile({ q, tile, showNew, order }: { q: Quiet; tile: PanelTile; showNew: boolean; order?: number }) {
  const l = tile.letter;
  const fresh = showNew && tile.fresh;
  return (
    <button type="button" class={`tile${fresh ? " fresh" : ""}${order ? " hint" : ""}`} aria-label={[l.ch, l.name, l.reading].filter(Boolean).join(" ")} onClick={() => q.play(l.audio ?? [])}>
      <span class="tl-ch" lang={q.course.language.code}>{l.ch}</span>
      <span class="tl-rd">{l.reading ?? ""}{tile.final ? ` (${q.t("quiet-letter-end")})` : ""}</span>
      {fresh && <span class="tl-new">{q.t("quiet-letter-new")}</span>}
      {order ? <span class="tl-n">{order}</span> : null}
    </button>
  );
}

/** One paper, laid out like the document, read one syllable at a time: the syllable being read is taken out of the card
 * and shown large, over the letters it is made of; its reading is typed under it. */
function PaperView({ q, paper, done, bookOpen, onBook, onBack }: { q: Quiet; paper: DeskPaper; done: boolean; bookOpen: boolean; onBook: () => void; onBack: () => void }) {
  const t = q.t;
  const chart = useMemo(() => letterChart(q.course), [q.course]);
  const syls = useMemo(() => paperSyllables(paper), [paper]);
  const [at, setAtState] = useState(() => (done ? syls.length : q.deskAt(paper.id)));
  const [typed, setTyped] = useState("");
  const [shake, setShake] = useState(false);
  // Per syllable: wrong tries, and how much help was asked for (0 none, 1 the letters marked, 2 the reading).
  const [wrong, setWrong] = useState(0);
  const [help, setHelp] = useState(0);
  const [geo, setGeo] = useState<string>("");
  const input = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const big = useRef<HTMLDivElement>(null);
  const finished = at >= syls.length;
  const cur = syls[at];
  const key = `${paper.id}:${at}`;
  const needed = cur ? syllableLetters(chart, cur.ch) : [];
  // The letters met before this syllable, taken once as it comes up (it then meets its own).
  const snap = useRef<{ key: string; before: ReadonlySet<string> }>();
  if (snap.current?.key !== key) snap.current = { key, before: new Set(q.deskMet() ?? []) };
  const before = snap.current.before;
  const panel = panelView(chart, needed, before);
  const first = before.size === 0;

  const setAt = (n: number) => {
    setAtState(n);
    q.setDeskAt(paper.id, n);
  };
  useEffect(() => {
    if (cur) q.meet(needed.map((r) => r.key));
  }, [key]);
  useEffect(() => input.current?.focus(), [key, bookOpen]);

  // Where the syllable sits in the card, and the line down to its big copy; the copy slides out of the card.
  const measure = () => {
    const s = stage.current, c = card.current, b = big.current;
    const from = c?.querySelector(".sy.cur .sy-ch");
    if (!s || !c || !b || !from) return void setGeo("");
    const sr = s.getBoundingClientRect(), fr = from.getBoundingClientRect(), br = b.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const sx = fr.left + fr.width / 2 - sr.left, sy = fr.bottom - sr.top;
    const bx = br.left + br.width / 2 - sr.left, by = br.top - sr.top;
    const mid = Math.min(by - 4, cr.bottom - sr.top + 6);
    setGeo(`M${sx} ${sy} V${mid} H${bx} V${by}`);
    return { fx: fr.left + fr.width / 2 - (br.left + br.width / 2), fy: fr.top + fr.height / 2 - (br.top + br.height / 2) };
  };
  useLayoutEffect(() => {
    const m = measure();
    const b = big.current;
    if (m && b && typeof b.animate === "function" && !matches("(prefers-reduced-motion: reduce)")) {
      b.animate([{ transform: `translate(${m.fx}px, ${m.fy}px) scale(0.35)`, opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: TAKE_MS, easing: "ease-out" });
    }
  }, [key]);
  useEffect(() => {
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [key]);

  // The last syllable read: the paper stays a moment, then the desk.
  useEffect(() => {
    if (!finished || done) return;
    q.readPaper(paper.id);
    const id = setTimeout(onBack, PAPER_DONE_MS);
    return () => clearTimeout(id);
  }, [finished]);

  const askHelp = () => {
    setHelp((h) => Math.min(2, h + 1));
    input.current?.focus();
  };
  const submit = (e: Event) => {
    e.preventDefault();
    const v = typed.trim();
    if (!cur || !v) return input.current?.focus();
    if (v.toLowerCase() === "book") return (setTyped(""), onBook());
    if (readsSyllable(v, cur.ch)) {
      setTyped("");
      setWrong(0);
      setHelp(0);
      if (lineRead(syls, cur.line, at + 1)) q.play(paper.lines[cur.line].audio ?? []);
      setAt(at + 1);
    } else {
      setWrong(wrong + 1);
      setShake(true);
      setTimeout(() => setShake(false), SHAKE_MS);
      input.current?.focus();
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Tab" && !e.shiftKey) return void (e.preventDefault(), onBook());
    if (e.key === "?") return void (e.preventDefault(), askHelp());
  };
  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    // `?` is never part of a reading: from a phone keyboard it asks for help too.
    if (v.includes("?")) askHelp();
    setTyped(v.replace(/\?/g, ""));
  };

  const at2 = new Map(syls.map((s, i) => [`${s.line}:${s.index}`, i] as const));
  const touch = matches("(pointer: coarse)");
  const order = new Map(panel.order.map((tl, i) => [tl.key, i + 1] as const));
  return (
    <div class="desk-screen reading">
      <div class="stage" ref={stage}>
        {cur && first && <p class="intro">{t("quiet-read-intro")}</p>}
        <div class={`paper paper-${paper.kind} compact`} lang={q.course.language.code} ref={card}>
          {paper.lines.map((l, li) => {
            const lineDone = lineRead(syls, li, at);
            const chars = [...l.text].map((ch, ci) => {
              const g = at2.get(`${li}:${ci}`);
              if (g === undefined) return <span key={ci} class="sy pass"><span class="sy-ch">{ch}</span></span>;
              const state = g < at ? "read" : g === at ? "cur" : "next";
              return (
                <span key={ci} class={`sy ${state}`}>
                  <span class="sy-ch">{ch}</span>
                  <span class="sy-rr" lang={`${q.course.language.code}-Latn`}>{g < at && !lineDone ? romanize(ch) : " "}</span>
                </span>
              );
            });
            const hasSyls = syls.some((s) => s.line === li);
            return (
              <div key={l.id} class={`pl pl-${l.id}${lineDone ? " said" : ""}`}>
                {lineDone ? <button type="button" class="pl-text" onClick={() => q.play(l.audio ?? [])}>{chars}</button> : <div class="pl-text">{chars}</div>}
                {hasSyls && <span class="pl-rr" lang={`${q.course.language.code}-Latn`}>{lineDone ? romanize(l.text) : " "}</span>}
              </div>
            );
          })}
        </div>
        {cur && geo && (
          <svg class="link" aria-hidden="true"><path d={geo} /></svg>
        )}
        {cur && (
          <div class="take">
            <div class="big" ref={big} lang={q.course.language.code}>{cur.ch}</div>
            <div class="panel">
              {panel.tiles.length > 0 && (
                <div class="tiles">
                  {panel.tiles.map((tl) => <Tile key={tl.key} q={q} tile={tl} showNew={!first} order={help >= 1 && !panel.collapsed && tl.needed ? order.get(tl.key) : undefined} />)}
                </div>
              )}
              {panel.collapsed && (
                <p class="other">
                  {t("quiet-read-other-letters")} <button type="button" class="link-btn" onClick={onBook}>{t("quiet-book").toLowerCase()}</button>
                </p>
              )}
              {help >= 1 && panel.collapsed && (
                <p class="hint-list" lang={q.course.language.code}>
                  {panel.order.map((tl, i) => <span key={tl.key}>{i > 0 ? " + " : ""}<b>{tl.letter.ch}</b> <span class="tl-rd">{tl.letter.reading}</span></span>)}
                </p>
              )}
            </div>
            {help >= 2 && <p class="rh-full">{t("quiet-read-help-full", { reading: romanize(cur.ch) })}</p>}
            <form class={shake ? "read-row shake" : "read-row"} onSubmit={submit} lang={q.course.learner}>
              <input ref={input} value={typed} placeholder={t("quiet-read-placeholder")} aria-label={t("quiet-read-placeholder")} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellcheck={false}
                enterkeyhint="go" onInput={onInput} onKeyDown={onKeyDown} />
              <button type="submit" class="go">↵ {t("quiet-enter")}</button>
            </form>
            <div class="read-tools">
              <button type="button" class={wrong >= HELP_AFTER ? "help hot" : "help"} onClick={askHelp}>{`? ${t("quiet-read-help")}`}</button>
              {!touch && <span class="dim">{t("quiet-read-tab-book")}</span>}
            </div>
          </div>
        )}
      </div>
      <footer class="bar">
        <button type="button" class="dim" onClick={onBack}>{t("quiet-esc")}</button>
        <button type="button" class="dim" onClick={onBook}>{t("quiet-book").toLowerCase()}</button>
      </footer>
    </div>
  );
}
