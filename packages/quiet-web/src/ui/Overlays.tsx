import { useState } from "preact/hooks";
import type { CatalogEntry, RenderedLine, WordState } from "@silver-tongue/core";
import {
  bookOn, dayPart, guideView, hasLetters, hudValues, letterCount, lettersView, nextRuby, nextSpeed, notebookDefault, notebookEntries, paperGlosses, papers, peopleList, quietRuby, rentDueInDays, settingsRows,
  type Paper, type SettingsScreen,
} from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import type { Page } from "./App";
import { partLabel } from "./Anchor";
import { Line } from "./Line";
import { Person, trustBar } from "./Person";

const touchScreen = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function Overlay({ q, title, head, hideTitle, onClose, children }: { q: Quiet; title: string; head?: preact.ComponentChildren; hideTitle?: boolean; onClose: () => void; children: preact.ComponentChildren }) {
  return (
    <div class="overlay" role="dialog" aria-label={title}>
      <header class="ov-head">
        {!hideTitle && <span class="ov-title">{title}</span>}
        {head && (typeof head === "string" ? <span class="dim">{head}</span> : head)}
        <button type="button" class="dim close" aria-label={q.t("web-close")} onClick={onClose}>{touchScreen() ? q.t("web-close").toLowerCase() : q.t("quiet-esc")}</button>
      </header>
      <div class="ov-body">{children}</div>
    </div>
  );
}

type WordsView = "shaky" | "met" | "known" | "all";
type NotebookView = "letters" | WordsView | "papers";
const VIEWS: WordsView[] = ["shaky", "met", "known", "all"];

/** A paper's line (a course with the Book): the line whole, in its own script, readings under the word groups not known yet. */
function PaperLine({ q, paper, now }: { q: Quiet; paper: Paper; now: number }) {
  const line = { text: paper.text, tokens: paper.tokens } as RenderedLine;
  return <span lang={q.course.language.locale}><Line line={line} now={now} book ruby={quietRuby(q.course, line, q.core.state.words, now, "auto")} /></span>;
}

/** Opens on the words that need work and why; the rest are one tap away on the tabs up top, which
 * count their words. No bars, no badges. Letters (for a language with a chart) come first, papers last. */
export function Notebook({ q, onClose, first }: { q: Quiet; onClose: () => void; first?: "letters" }) {
  // With the Book it opens on the first list with something in it, never on an empty one.
  const [tab, setTab] = useState<NotebookView>(() => {
    if (first && hasLetters(q.course)) return first;
    if (!bookOn(q.course)) return "shaky";
    const { counts } = notebookDefault(q.course, q.core.state, Date.now());
    return VIEWS.find((v) => v !== "all" && counts[v] > 0) ?? "all";
  });
  const [open, setOpen] = useState<number | null>(null);
  const { t, course, core } = q;
  const now = Date.now();
  const nb = notebookDefault(course, core.state, now);
  const whyText = (w: (typeof nb.shaky)[number]) =>
    w.why === "missed" ? t("quiet-why-missed", { count: w.count ?? 1 }) : t(`quiet-why-${w.why}`);
  const words = tab !== "letters" && tab !== "papers";
  const full = !words || tab === "shaky" ? undefined : notebookEntries(course, core.state, t, now);
  const keep = (s: WordState) => tab === "all" || s === tab;
  const kept = tab === "papers" ? papers(course, core.state, t, now) : [];
  const pick = (v: NotebookView) => (setTab(v), setOpen(null));
  const book = bookOn(course);
  const tabButton = (v: NotebookView, label: string) => (
    <button key={v} type="button" role="tab" aria-selected={v === tab} class={v === tab ? "tab on" : "tab"} onClick={() => pick(v)}>{label}</button>
  );
  const tabs = (
    <nav class="tabs" role="tablist">
      {book && hasLetters(course) && tabButton("letters", t("notebook-letters"))}
      {VIEWS.map((v) => tabButton(v, t(`quiet-tab-${v}`, v === "all" ? { count: nb.counts.shaky + nb.counts.met + nb.counts.known } : { count: nb.counts[v] })))}
      {book && tabButton("papers", t("notebook-papers"))}
    </nav>
  );
  // On a course whose papers are read at the desk, the Book knows only the letters met there.
  const met = q.deskMet();
  const guide = tab === "letters" ? guideView(course, t, met) : [];
  const chart = tab === "letters" ? lettersView(course, t, met) : [];
  const count = met ? letterCount(course, met) : undefined;
  return (
    <Overlay q={q} title={t(book ? "quiet-book" : "quiet-notebook")} head={tabs} onClose={onClose}>
      {tab === "letters" && count && (
        <p class="dim">{count.n ? t("quiet-letters-count", { n: count.n, total: count.total }) : t("quiet-letters-none")}</p>
      )}
      {tab === "letters" && guide.length > 0 && (
        <section>
          <p class="nb-place">{t("quiet-letters-guide")}</p>
          <ol class="guide">
            {guide.map((g) => (
              <li key={g.id}>
                <p class="guide-text">{g.text}</p>
                <div class="guide-ex" lang={course.language.code}>
                  {g.examples.map((e, i) => (
                    <button key={i} type="button" class="letter" aria-label={`${e.text} ${e.reading}`} onClick={() => q.play(e.audio)}>
                      <span class="nb-w">{e.text}</span><span class="nb-r" lang={`${course.language.code}-Latn`}>{e.reading}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {chart.map((g) => (
        <section key={g.id}>
          <p class="nb-place">{g.label}</p>
          <div class="letters">
            {g.letters.map((l, i) => (
              <button key={i} type="button" class="letter" aria-label={[l.ch, l.name, l.reading].filter(Boolean).join(" ")} onClick={() => q.play(l.audio ?? [])}>
                <span class="nb-w">{l.ch}</span><span class="nb-r">{l.reading ?? ""}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {tab === "papers" && (kept.length ? kept.map((p, i) => (
        <section key={`${p.scene}/${p.exchange}`} class="paper-row">
          <button type="button" class="nb-paper" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{t("notebook-paper-from", { npc: p.npcName, place: q.placeLabel(p.place) })}</span>
            <span class="dim">{t("notebook-paper-progress", { known: p.known, total: p.total })}</span>
          </button>
          {open === i && (
            <div class="paper-body">
              <p>
                <PaperLine q={q} paper={p} now={now} />
                {p.audio.length > 0 && <button type="button" class="play" aria-label={t("vn-play-word")} onClick={() => q.play(p.audio)}>▶</button>}
              </p>
              {paperGlosses(course, p).map((g) => <p key={g.word}><span class="nb-w">{g.text}</span> <span class="dim">{g.gloss}</span></p>)}
            </div>
          )}
        </section>
      )) : <p class="dim">{t("notebook-papers-empty")}</p>)}
      {tab === "shaky" && (nb.shaky.length ? (
        <div class="nb-grid">
          {nb.shaky.map((w) => (
            <button key={w.word} type="button" class="nb-row" onClick={() => q.play(course.words[w.word]?.audio ?? [])}>
              <span class="nb-w">{w.text}</span><span class="nb-r">{w.reading}</span><span>{w.gloss}</span><span class="dim">{whyText(w)}</span>
            </button>
          ))}
        </div>
      ) : <p class="dim">{t("quiet-nb-none")}</p>)}
      {full && (
        <>
          {tab === "all" && full.progress.map((p) => <p key={p} class="dim">{p}</p>)}
          {full.empty && <p class="dim">{t("notebook-empty")}</p>}
          {full.groups.map((g) => {
            const words = g.words.filter((w) => keep(w.state));
            if (!words.length) return null;
            return (
              <section key={g.title}>
                <p class="nb-place">{g.title}</p>
                <div class="nb-grid three">
                  {words.map((w) => (
                    <button key={w.id} type="button" class="nb-row" onClick={() => q.play(w.clips)}>
                      <span class="nb-w">{w.text}</span><span class="nb-r">{w.readings.join(" ")}</span><span>{w.short}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          {tab === "all" && full.notes.length > 0 && (
            <section>
              <p class="nb-place">{t("notebook-notes")}</p>
              {full.notes.map((n) => <div key={n.title} class="nb-note"><b>{n.title}</b><p>{n.text}</p></div>)}
            </section>
          )}
        </>
      )}
    </Overlay>
  );
}

/** The full ledger: everything the anchor row leaves out, and everyone: the people met, then the rest. Each opens their page. */
export function Status({ q, audioAvailable, onClose }: { q: Quiet; audioAvailable: boolean; onClose: () => void }) {
  const [person, setPerson] = useState<string | null>(null);
  const { t, course, core } = q;
  if (person) return <Person q={q} npc={person} onBack={() => setPerson(null)} onClose={onClose} />;
  const s = core.state;
  const hud = hudValues(course, s, t, Date.now());
  const currency = course.world.currency;
  const people = peopleList(course, s, t);
  const rows = [
    t("quiet-st-day", { day: s.day, part: partLabel(t, dayPart(course, s)) }),
    t("quiet-st-wallet", { currency, wallet: s.wallet }),
    t("quiet-st-rent", { currency, rent: course.world.rentPerWeek, days: s.rentLate ? 0 : rentDueInDays(s.day) }) + (s.rentLate ? ` · ${t("quiet-rent-late")}` : ""),
    t("notebook-rank", { rank: hud.rankLabel }),
    s.errand ? t("quiet-st-parcel") : t("quiet-st-no-parcel"),
    t("settings-sound", { sound: t(!audioAvailable ? "settings-sound-none" : s.sound === false ? "settings-sound-off" : "settings-sound-on") }),
  ];
  return (
    <Overlay q={q} title={t("quiet-status")} onClose={onClose}>
      {rows.map((r) => <p key={r}>{r}</p>)}
      <p class="dim st-people">{t("quiet-people")}</p>
      {people.met.map((r) => (
        <button key={r.npc} type="button" class="person" onClick={() => setPerson(r.npc)}>
          <span class="cyan">{r.name}</span><span class="cyan">{trustBar(r.trust)}</span><span class="dim">›</span>
        </button>
      ))}
      {people.unmet.length > 0 && <p class="dim st-people">{t("quiet-unmet", { count: people.unmet.length })}</p>}
      {people.unmet.map((r) => (
        <button key={r.npc} type="button" class="person dim" onClick={() => setPerson(r.npc)}>
          <span>{r.name}</span><span class="p-small">{r.place}</span><span>›</span>
        </button>
      ))}
    </Overlay>
  );
}

export function Menu({ q, page, onClose, onGames }: { q: Quiet; page: Page; onClose: () => void; onGames: () => void }) {
  const [screen, setScreen] = useState<SettingsScreen>("main");
  const [speed, setSpeed] = useState(page.speed); // its own copy, so a press repaints the row
  const [ruby, setRuby] = useState(page.ruby);
  const rows = settingsRows(screen, { course: q.course, catalog: page.catalog as CatalogEntry[], state: q.core.state, t: q.t, audioAvailable: page.audioAvailable, ruby });
  const title = screen === "main" ? q.t("vn-settings") : screen === "course" ? q.t("settings-pick-course") : q.t("settings-pick-reading");
  return (
    <Overlay q={q} title={title} onClose={onClose}>
      {rows.map((r) => (
        <button key={r.label} type="button" class="row" onClick={() => {
          const a = r.action;
          if (a.kind === "open") setScreen(a.screen);
          else if (a.kind === "back") setScreen("main");
          else if (a.kind === "switch") page.switchTo(a.course, a.learner);
          else if (a.kind === "ruby") {
            const next = nextRuby(ruby);
            setRuby(next);
            page.setRuby(next);
          } else q.toggleSound();
        }}>{r.label}</button>
      ))}
      {screen === "main" && <button type="button" class="row" onClick={() => {
        const next = nextSpeed(speed);
        setSpeed(next);
        page.setSpeed(next);
      }}>{q.t("vn-speed", { speed: q.t(`vn-speed-${speed}`) })}</button>}
      {screen === "main" && <button type="button" class="row" onClick={onGames}>{q.t("vn-games")}</button>}
      {screen === "main" && page.vnUrl && <a class="row" href={page.vnUrl}>{q.t("vn-play-visual")}</a>}
      {screen === "main" && page.textUrl && <a class="row" href={page.textUrl}>{q.t("vn-play-text")}</a>}
    </Overlay>
  );
}

export function Games({ q, page, onClose }: { q: Quiet; page: Page; onClose: () => void }) {
  const [panel, setPanel] = useState<"list" | "export" | "import">("list");
  const [line, setLine] = useState("");
  const [note, setNote] = useState("");
  const games = page.games.list();
  const t = q.t;
  return (
    <Overlay q={q} title={t("vn-games")} onClose={onClose}>
      <nav class="links">
        <button type="button" class="link" onClick={() => setPanel("list")}>{t("resume-title").replace(/:$/, "")}</button>
        <button type="button" class="link" onClick={() => page.games.startNew()}>{t("web-new")}</button>
        <button type="button" class="link" onClick={async () => (setLine(await page.games.exportLine()), setPanel("export"))}>{t("web-export")}</button>
        <button type="button" class="link" onClick={() => (setLine(""), setNote(""), setPanel("import"))}>{t("web-import")}</button>
      </nav>
      {panel === "list" && (games.length ? games.map((g) => <button key={g.id} type="button" class="row" onClick={() => page.games.open(g.id)}>{g.label}</button>) : <p class="dim">{t("web-games-none")}</p>)}
      {panel === "export" && (
        <>
          <p class="dim">{t("web-export-hint")}</p>
          <textarea readOnly rows={5} value={line} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button type="button" class="row" onClick={async () => { try { await navigator.clipboard.writeText(line); setNote(t("web-copied")); } catch { /* select and copy by hand */ } }}>{t("web-copy")}</button>
          <p class="dim">{note}</p>
        </>
      )}
      {panel === "import" && (
        <>
          <p class="dim">{t("web-import-hint")}</p>
          <textarea rows={5} placeholder="st1:…" value={line} onInput={(e) => setLine((e.target as HTMLTextAreaElement).value)} />
          <button type="button" class="row" onClick={async () => setNote((await page.games.importLine(line)) ?? "")}>{t("web-import-go")}</button>
          <p class="dim">{note}</p>
        </>
      )}
    </Overlay>
  );
}
