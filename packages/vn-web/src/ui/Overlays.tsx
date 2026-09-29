import { useState } from "preact/hooks";
import type { CatalogEntry } from "@silver-tongue/core";
import { bookOn, hasLetters, lettersView, nextRuby, nextSpeed, notebookEntries, paperGlosses, paperParts, papers, settingsRows, type Paper, type SettingsScreen } from "@silver-tongue/view";
import type { Vn, VnView } from "../vn";
import type { Page } from "./App";
import { Line } from "./Line";

const MARK = { unseen: " ", met: "○", shaky: "◐", known: "●" } as const;

function Overlay({ title, onClose, children, close }: { title: string; onClose: () => void; children: preact.ComponentChildren; close: string }) {
  return (
    <div class="overlay-back" onClick={onClose}>
      <div class="overlay" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header><h2>{title}</h2><button type="button" aria-label={close} onClick={onClose}>✕</button></header>
        <div class="overlay-body">{children}</div>
      </div>
    </div>
  );
}

type BookTab = "letters" | "words" | "papers" | "notes";

/** A paper's line: known words as they are, the rest blanks, or their reading when there is one. */
function PaperLine({ paper }: { paper: Paper }) {
  return (
    <span class="line">
      {paperParts(paper).map((part, i) =>
        !("word" in part) ? <span key={i}>{part.text}</span>
          : part.blank.known ? <b key={i}>{part.text}</b>
          : <span key={i} class="blank">{part.blank.reading ?? "____"}</span>,
      )}
    </span>
  );
}

/** The notebook as it was, for a course without the Book: words by group, then notes. */
function Notebook_({ vn, onClose }: { vn: Vn; onClose: () => void }) {
  const nb = notebookEntries(vn.course, vn.core.state, vn.t, Date.now());
  return (
    <Overlay title={vn.t("vn-notebook")} onClose={onClose} close={vn.t("web-close")}>
      <div class="paper">
        {nb.progress.map((p) => <p key={p} class="progress">{p}</p>)}
        {nb.empty && <p class="muted">{vn.t("notebook-empty")}</p>}
        {nb.groups.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            {g.words.map((w) => (
              <div key={w.id} class="nb-word">
                <span class="nb-mark">{MARK[w.state]}</span>
                <b>{w.text}</b> <span class="nb-reading">{w.readings.join(" ")}</span> — {w.short}
                {w.clips.length > 0 && <button type="button" aria-label={vn.t("vn-play-word")} onClick={() => vn.play(w.clips)}>▶</button>}
                {w.first && <div class="nb-first">{w.first}</div>}
              </div>
            ))}
          </section>
        ))}
        {nb.notes.length > 0 && (
          <section>
            <h3>{vn.t("notebook-notes")}</h3>
            {nb.notes.map((n) => <div key={n.title} class="nb-note"><b>{n.title}</b><p>{n.text}</p></div>)}
          </section>
        )}
      </div>
    </Overlay>
  );
}

/** The notebook: the Book for a course that uses it (see bookOn), else the notebook as it was. */
export function Notebook({ vn, onClose }: { vn: Vn; onClose: () => void }) {
  return bookOn(vn.course) ? <Book vn={vn} onClose={onClose} /> : <Notebook_ vn={vn} onClose={onClose} />;
}

/** The Book: its letter chart (for a language with one), the words heard, the papers kept, and notes. */
function Book({ vn, onClose }: { vn: Vn; onClose: () => void }) {
  const [tab, setTab] = useState<BookTab>("words");
  const [open, setOpen] = useState<number | null>(null);
  const { t, course } = vn;
  const now = Date.now();
  const tabs: BookTab[] = [...(hasLetters(course) ? ["letters" as const] : []), "words", "papers", "notes"];
  const nb = notebookEntries(course, vn.core.state, t, now);
  const kept = tab === "papers" ? papers(course, vn.core.state, t, now) : [];
  return (
    <Overlay title={t("vn-book")} onClose={onClose} close={t("web-close")}>
      <nav class="tabs" role="tablist">
        {tabs.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={id === tab} class={id === tab ? "on" : ""} onClick={() => (setTab(id), setOpen(null))}>{t(`notebook-${id}`)}</button>
        ))}
      </nav>
      {tab === "letters" && (
        <div class="paper">
          {lettersView(course, t).map((g) => (
            <section key={g.id}>
              <h3>{g.label}</h3>
              <div class="letters">
                {g.letters.map((l, i) => (
                  <button key={i} type="button" class="letter" aria-label={[l.ch, l.name, l.reading].filter(Boolean).join(" ")} onClick={() => vn.play(l.audio ?? [])}>
                    <b>{l.ch}</b><span>{l.reading ?? ""}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === "words" && (
        <div class="paper">
          {nb.progress.map((p) => <p key={p} class="progress">{p}</p>)}
          {nb.empty && <p class="muted">{t("notebook-empty")}</p>}
          {nb.groups.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              {g.words.map((w) => (
                <div key={w.id} class="nb-word">
                  <span class="nb-mark">{MARK[w.state]}</span>
                  <b>{w.text}</b> <span class="nb-reading">{w.readings.join(" ")}</span> — {w.short}
                  {w.clips.length > 0 && <button type="button" aria-label={t("vn-play-word")} onClick={() => vn.play(w.clips)}>▶</button>}
                  {w.first && <div class="nb-first">{w.first}</div>}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === "papers" && (
        <div class="paper">
          {!kept.length && <p class="muted">{t("notebook-papers-empty")}</p>}
          {kept.map((p, i) => (
            <div key={`${p.scene}/${p.exchange}`} class="nb-paper">
              <button type="button" class="nb-paper-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <b>{t("notebook-paper-from", { npc: p.npcName, place: p.placeName })}</b>
                <span class="muted">{t("notebook-paper-progress", { known: p.known, total: p.total })}</span>
              </button>
              {open === i && (
                <div class="nb-paper-body">
                  <p>
                    <PaperLine paper={p} />
                    {p.audio.length > 0 && <button type="button" aria-label={t("vn-play-word")} onClick={() => vn.play(p.audio)}>▶</button>}
                  </p>
                  {paperGlosses(course, p).map((g) => <div key={g.word} class="nb-word"><b>{g.text}</b> — {g.gloss}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "notes" && (
        <div class="paper">
          {!nb.notes.length && <p class="muted">{t("notebook-notes-empty")}</p>}
          {nb.notes.map((n) => <div key={n.title} class="nb-note"><b>{n.title}</b><p>{n.text}</p></div>)}
        </div>
      )}
    </Overlay>
  );
}

export function Backlog({ vn, view, onClose }: { vn: Vn; view: VnView; onClose: () => void }) {
  const who = (s?: string) => (s === "player" ? vn.core.state.player ?? vn.t("you") : s ? vn.t(`npc-${s}`) : "");
  return (
    <Overlay title={vn.t("vn-backlog")} onClose={onClose} close={vn.t("web-close")}>
      {view.backlog.map((b, i) => (
        <p key={i} class={`bl tone-${b.tone ?? "plain"}${b.speaker ? "" : " narration"}`}>
          {b.speaker && <b>{who(b.speaker)}: </b>}
          {b.title && <b>{b.title} </b>}
          {b.line ? <Line line={b.line} /> : b.text}
        </p>
      ))}
    </Overlay>
  );
}

export function Menu({ vn, page, onClose, onGames }: { vn: Vn; page: Page; onClose: () => void; onGames: () => void }) {
  const [screen, setScreen] = useState<SettingsScreen>("main");
  // Settings shows its own copy, so a press repaints the row; it is seeded from the page, which is
  // live, and this screen is unmounted with the overlay and seeded again each time it is opened.
  const [prefs, setPrefs] = useState(page.prefs);
  const rows = settingsRows(screen, { course: vn.course, catalog: page.catalog as CatalogEntry[], state: vn.core.state, t: vn.t, audioAvailable: page.audioAvailable, ruby: prefs.ruby });
  const title = screen === "main" ? vn.t("vn-settings") : screen === "course" ? vn.t("settings-pick-course") : vn.t("settings-pick-reading");
  return (
    <Overlay title={title} onClose={onClose} close={vn.t("web-close")}>
      {rows.map((r) => (
        <button key={r.label} type="button" class="row" onClick={() => {
          const a = r.action;
          if (a.kind === "open") setScreen(a.screen);
          else if (a.kind === "back") setScreen("main");
          else if (a.kind === "switch") page.switchTo(a.course, a.learner);
          else if (a.kind === "ruby") {
            const ruby = nextRuby(prefs.ruby);
            setPrefs({ ...prefs, ruby });
            page.setPref({ ruby });
          } else vn.toggleSound();
        }}>{r.label}</button>
      ))}
      {screen === "main" && <button type="button" class="row" onClick={() => {
        const speed = nextSpeed(prefs.speed);
        setPrefs({ ...prefs, speed });
        page.setPref({ speed });
      }}>{vn.t("vn-speed", { speed: vn.t(`vn-speed-${prefs.speed}`) })}</button>}
      {screen === "main" && <button type="button" class="row" onClick={() => {
        // Only the advance row moves the timer; the speed row is heard through the audio.
        const autoAdvance = !prefs.autoAdvance;
        setPrefs({ ...prefs, autoAdvance });
        page.setPref({ autoAdvance });
        vn.setAuto(autoAdvance); // and this repaints the screen
      }}>{vn.t("vn-advance", { mode: vn.t(prefs.autoAdvance ? "vn-advance-auto" : "vn-advance-tap") })}</button>}
      {screen === "main" && <button type="button" class="row" onClick={onGames}>{vn.t("vn-games")}</button>}
      {screen === "main" && page.textUrl && <a class="row" href={page.textUrl}>{vn.t("vn-play-text")}</a>}
      {screen === "main" && page.quietUrl && <a class="row" href={page.quietUrl}>{vn.t("vn-play-quiet")}</a>}
    </Overlay>
  );
}

export function Games({ vn, page, onClose }: { vn: Vn; page: Page; onClose: () => void }) {
  const [panel, setPanel] = useState<"list" | "export" | "import">("list");
  const [line, setLine] = useState("");
  const [note, setNote] = useState("");
  const games = page.games.list();
  return (
    <Overlay title={vn.t("vn-games")} onClose={onClose} close={vn.t("web-close")}>
      <nav class="tabs">
        <button type="button" onClick={() => setPanel("list")}>{vn.t("resume-title").replace(/:$/, "")}</button>
        <button type="button" onClick={() => page.games.startNew()}>{vn.t("web-new")}</button>
        <button type="button" onClick={async () => (setLine(await page.games.exportLine()), setPanel("export"))}>{vn.t("web-export")}</button>
        <button type="button" onClick={() => (setLine(""), setNote(""), setPanel("import"))}>{vn.t("web-import")}</button>
      </nav>
      {panel === "list" && (games.length ? games.map((g) => <button key={g.id} type="button" class="row" onClick={() => page.games.open(g.id)}>{g.label}</button>) : <p class="muted">{vn.t("web-games-none")}</p>)}
      {panel === "export" && (
        <>
          <p class="muted">{vn.t("web-export-hint")}</p>
          <textarea readOnly rows={5} value={line} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          <button type="button" class="primary" onClick={async () => { try { await navigator.clipboard.writeText(line); setNote(vn.t("web-copied")); } catch { /* select and copy by hand */ } }}>{vn.t("web-copy")}</button>
          <p class="muted">{note}</p>
        </>
      )}
      {panel === "import" && (
        <>
          <p class="muted">{vn.t("web-import-hint")}</p>
          <textarea rows={5} placeholder="st1:…" value={line} onInput={(e) => setLine((e.target as HTMLTextAreaElement).value)} />
          <button type="button" class="primary" onClick={async () => setNote((await page.games.importLine(line)) ?? "")}>{vn.t("web-import-go")}</button>
          <p class="muted">{note}</p>
        </>
      )}
    </Overlay>
  );
}
