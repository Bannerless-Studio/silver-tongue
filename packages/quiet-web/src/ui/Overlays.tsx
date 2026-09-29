import { useState } from "preact/hooks";
import type { CatalogEntry, WordState } from "@silver-tongue/core";
import {
  dayPart, hasLetters, hudValues, lettersView, nextRuby, nextSpeed, notebookDefault, notebookEntries, paperGlosses, paperParts, papers, peopleList, rentDueInDays, settingsRows,
  type Paper, type SettingsScreen,
} from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import type { Page } from "./App";
import { partLabel } from "./Anchor";
import { Person, trustBar } from "./Person";

export function Overlay({ q, title, head, hideTitle, onClose, children }: { q: Quiet; title: string; head?: preact.ComponentChildren; hideTitle?: boolean; onClose: () => void; children: preact.ComponentChildren }) {
  return (
    <div class="overlay" role="dialog" aria-label={title}>
      <header class="ov-head">
        {!hideTitle && <span class="ov-title">{title}</span>}
        {head && (typeof head === "string" ? <span class="dim">{head}</span> : head)}
        <button type="button" class="dim close" aria-label={q.t("web-close")} onClick={onClose}>{q.t("quiet-esc")}</button>
      </header>
      <div class="ov-body">{children}</div>
    </div>
  );
}

type WordsView = "shaky" | "met" | "known" | "all";
type NotebookView = "letters" | WordsView | "papers";
const VIEWS: WordsView[] = ["shaky", "met", "known", "all"];

/** A paper's line: known words as they are, the rest blanks, or their reading (dim) when there is one. */
function PaperLine({ paper }: { paper: Paper }) {
  return (
    <span class="line">
      {paperParts(paper).map((part, i) =>
        !("word" in part) ? <span key={i}>{part.text}</span>
          : part.blank.known ? <span key={i} class="nb-w">{part.text}</span>
          : <span key={i} class="dim blank">{part.blank.reading ?? "____"}</span>,
      )}
    </span>
  );
}

/** Opens on the words that need work and why; the rest are one tap away on the tabs up top, which
 * count their words. No bars, no badges. Letters (for a language with a chart) come first, papers last. */
export function Notebook({ q, onClose }: { q: Quiet; onClose: () => void }) {
  const [tab, setTab] = useState<NotebookView>("shaky");
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
  const tabButton = (v: NotebookView, label: string) => (
    <button key={v} type="button" role="tab" aria-selected={v === tab} class={v === tab ? "tab on" : "tab"} onClick={() => pick(v)}>{label}</button>
  );
  const tabs = (
    <nav class="tabs" role="tablist">
      {hasLetters(course) && tabButton("letters", t("notebook-letters"))}
      {VIEWS.map((v) => tabButton(v, t(`quiet-tab-${v}`, v === "all" ? { count: nb.counts.shaky + nb.counts.met + nb.counts.known } : { count: nb.counts[v] })))}
      {tabButton("papers", t("notebook-papers"))}
    </nav>
  );
  return (
    <Overlay q={q} title={t("quiet-notebook")} head={tabs} onClose={onClose}>
      {tab === "letters" && lettersView(course, t).map((g) => (
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
            <span>{t("notebook-paper-from", { npc: p.npcName, place: p.placeName })}</span>
            <span class="dim">{t("notebook-paper-progress", { known: p.known, total: p.total })}</span>
          </button>
          {open === i && (
            <div class="paper-body">
              <p>
                <PaperLine paper={p} />
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
