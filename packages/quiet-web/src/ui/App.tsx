import { useEffect, useRef, useState } from "preact/hooks";
import type { CatalogEntry, WordId } from "@silver-tongue/core";
import { bookOn, wordExample, type RubySetting, type SpeechSpeed } from "@silver-tongue/view";
import { bookKey, keyAction, type Overlay } from "../keys";
import { latestNpcLine, type Beat, type Quiet } from "../quiet";
import { Anchor } from "./Anchor";
import { Games, Menu, Notebook, Status } from "./Overlays";
import { Desk } from "./Desk";
import { Opening } from "./Opening";
import { Prompt, primaryAction } from "./Prompt";
import { Building, finishTilesHint, History, Pieces, Slips, slipChoice, Stage, useStage } from "./Stage";
import { Toasts } from "./Toasts";
import { Transcript, type Reveal } from "./Transcript";
import { useQuiet } from "./use-quiet";

export interface Page {
  catalog: CatalogEntry[];
  /** the course has sound this browser can play */
  audioAvailable: boolean;
  /** how fast clips are said, kept in the player's settings */
  speed: SpeechSpeed;
  setSpeed(speed: SpeechSpeed): void;
  /** when readings are written under words, kept in the player's settings */
  ruby: RubySetting;
  setRuby(ruby: RubySetting): void;
  switchTo(course: string, learner: string): void;
  games: {
    list(): { id: string; label: string }[];
    open(id: string): void;
    startNew(): void;
    exportLine(): Promise<string>;
    importLine(line: string): Promise<string | null>;
  };
  textUrl: string;
  vnUrl: string;
}

type Open = Overlay | "games" | null;
/** Keys a touch screen has no keyboard for (like the text page's key bar). */
const keybar = (book: boolean): { label: string; key: string }[] => [
  { label: "?", key: "?" }, { label: bookKey(book).toUpperCase(), key: bookKey(book) }, { label: "S", key: "s" }, { label: "⌫", key: "Backspace" }, { label: "↵", key: "Enter" },
];

export function App({ q, page }: { q: Quiet; page: Page }) {
  const view = useQuiet(q);
  const { shown, skip } = useStage(view);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [open, setOpen] = useState<Open>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const t = q.t;

  const onWord = (b: Beat, w: WordId, surface: string) => {
    if (reveal?.kind === "word" && reveal.beat === b.id && reveal.card.word === w) return setReveal(null);
    // Logged as help, as the game intends; the card also shows the word in another line of the game.
    const example = wordExample(q.course, w, b.line?.text);
    setReveal({ beat: b.id, kind: "word", card: q.lookUp(w, surface), ...(example ? { example } : {}) });
  };
  const closeReveal = () => setReveal(null);
  const onReveal = (b: Beat) => {
    if (reveal?.kind === "line" && reveal.beat === b.id) return setReveal(null);
    const line = b.restate?.line ?? b.line; // a reaction's ? opens the request it says again
    const card = line && q.sentence(line);
    if (card) setReveal({ beat: b.id, kind: "line", card });
  };

  const press = (key: string) => {
    // A held moment on the stage (a reply just said, a scene opening): any key moves on, and does nothing else.
    if (bookOn(q.course) && shownRef.current.hold && !open) {
      skip();
      return true;
    }
    const a = keyAction(key, { overlay: !!open, phase: q.view().phase.kind, typing: false, modifier: false, book: bookOn(q.course), primary: primaryAction(bookOn(q.course), q.view().phase) });
    if (!a) return false;
    const p = q.view().phase;
    if (a.kind === "close") setOpen(null);
    else if (a.kind === "choose") (p.kind === "tiles" ? q.placeTile(a.n) : q.choose(bookOn(q.course) ? slipChoice(q.view(), shownRef.current.ex, a.n) : a.n));
    else if (a.kind === "undo") q.undoTile();
    else if (a.kind === "send") {
      if (bookOn(q.course)) finishTilesHint(q.course.id);
      q.sendTiles();
    }
    else if (a.kind === "reveal") {
      const last = latestNpcLine(q.view().backlog);
      if (last) onReveal(last);
    } else if (a.kind === "open") setOpen(a.overlay);
    else if (a.kind === "sound") q.toggleSound();
    else if (a.kind === "replay") q.replay();
    return true;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      // The desk: only the Book opens ([n]) and closes (Escape); the rest is the desk's own.
      if (q.view().desk) {
        if (e.key === "Escape" && open) (e.preventDefault(), setOpen(null));
        else if (!typing && !open && e.key.toLowerCase() === bookKey(true)) (e.preventDefault(), setOpen("notebook"));
        return;
      }
      // In a text field (a name, a save line) keys are for typing; Escape still closes the overlay.
      if (typing) {
        if (e.key === "Escape" && open) (e.preventDefault(), setOpen(null));
        return;
      }
      if (press(e.key)) e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const close = () => setOpen(null);
  // A course with the Book keeps controls away until they have a use: Status from day 2 (money matters then),
  // and no touch key bar: every control it would copy is on screen as itself. Book and Settings stay.
  const book = bookOn(q.course);
  // A new game on a course with the Book: the crawl and the name screen, nothing else on screen.
  if (view.opening) return <Opening q={q} story={view.opening} />;
  // Then, on a course with papers, the desk: the papers read out before the game starts. The Book opens over it.
  if (view.desk) {
    return (
      <>
        <Desk q={q} papers={view.desk} bookOpen={open === "notebook"} onBook={() => setOpen("notebook")} />
        {open === "notebook" && <Notebook q={q} first="letters" onClose={close} />}
      </>
    );
  }
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const p = view.phase;
  return (
    <div class={book ? "term app book" : "term app"}>
      <Anchor q={q} view={view} audioAvailable={page.audioAvailable} />
      {book ? (
        // A course with the Book: the conversation is a stage (Stage.tsx); a tap on a held moment moves on.
        <main class="stage-wrap" onClick={shown.hold ? skip : undefined}>
          <History q={q} rows={shown.history} />
          <Stage q={q} view={view} shown={shown} ruby={page.ruby} reveal={reveal} onWord={onWord} onReveal={onReveal} onClose={closeReveal}>
            {!shown.hold && <Building q={q} view={view} touch={touch} />}
          </Stage>
          <div class="replies">
            <Toasts q={q} view={view} />
            {!shown.hold && (p.kind === "pick" ? <Slips q={q} view={view} ex={shown.ex} ruby={page.ruby} touch={touch} />
              : p.kind === "tiles" ? <Pieces q={q} view={view} touch={touch} />
              : <Prompt q={q} view={view} ruby={page.ruby} />)}
          </div>
        </main>
      ) : (
        <Transcript q={q} view={view} ruby={page.ruby} reveal={reveal} onWord={onWord} onReveal={onReveal}>
          <Toasts q={q} view={view} />
          <Prompt q={q} view={view} ruby={page.ruby} />
        </Transcript>
      )}
      <footer class="bar">
        <button type="button" class="dim" onClick={() => setOpen("notebook")}>{t(bookOn(q.course) ? "quiet-book" : "quiet-notebook").toLowerCase()}</button>
        {(!book || q.core.state.day > 1) && <button type="button" class="dim" onClick={() => setOpen("status")}>{t("quiet-status").toLowerCase()}</button>}
        <button type="button" class="dim" onClick={() => setOpen("settings")}>{t("vn-settings").toLowerCase()}</button>
      </footer>
      {!book && (
        <div class="keybar">
          {keybar(book).map((k) => <button key={k.key} type="button" onClick={() => press(k.key)}>{k.label}</button>)}
        </div>
      )}
      {open === "notebook" && <Notebook q={q} onClose={close} />}
      {open === "status" && <Status q={q} audioAvailable={page.audioAvailable} onClose={close} />}
      {open === "settings" && <Menu q={q} page={page} onClose={close} onGames={() => setOpen("games")} />}
      {open === "games" && <Games q={q} page={page} onClose={close} />}
    </div>
  );
}
