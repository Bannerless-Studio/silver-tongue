import { useState } from "preact/hooks";
import type { CatalogEntry, WordState } from "@silver-tongue/core";
import { hudValues, nextSpeed, notebookDefault, notebookEntries, rentDueInDays, settingsRows, type SettingsScreen } from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import type { Page } from "./App";

function Overlay({ q, title, head, onClose, children }: { q: Quiet; title: string; head?: preact.ComponentChildren; onClose: () => void; children: preact.ComponentChildren }) {
  return (
    <div class="overlay" role="dialog" aria-label={title}>
      <header class="ov-head">
        <span class="ov-title">{title}</span>
        {head && (typeof head === "string" ? <span class="dim">{head}</span> : head)}
        <button type="button" class="dim close" aria-label={q.t("web-close")} onClick={onClose}>{q.t("quiet-esc")}</button>
      </header>
      <div class="ov-body">{children}</div>
    </div>
  );
}

type NotebookView = "shaky" | "met" | "known" | "all";
const VIEWS: NotebookView[] = ["shaky", "met", "known", "all"];

/** Opens on the words that need work and why; the rest are one tap away on the tabs up top, which
 * count their words. No bars, no badges. */
export function Notebook({ q, onClose }: { q: Quiet; onClose: () => void }) {
  const [tab, setTab] = useState<NotebookView>("shaky");
  const { t, course, core } = q;
  const now = Date.now();
  const nb = notebookDefault(course, core.state, now);
  const whyText = (w: (typeof nb.shaky)[number]) =>
    w.why === "missed" ? t("quiet-why-missed", { count: w.count ?? 1 }) : t(`quiet-why-${w.why}`);
  const full = tab === "shaky" ? undefined : notebookEntries(course, core.state, t, now);
  const keep = (s: WordState) => tab === "all" || s === tab;
  const tabs = (
    <nav class="tabs" role="tablist">
      {VIEWS.map((v) => (
        <button key={v} type="button" role="tab" aria-selected={v === tab} class={v === tab ? "tab on" : "tab"} onClick={() => setTab(v)}>
          {t(`quiet-tab-${v}`, v === "all" ? { count: nb.counts.shaky + nb.counts.met + nb.counts.known } : { count: nb.counts[v] })}
        </button>
      ))}
    </nav>
  );
  return (
    <Overlay q={q} title={t("quiet-notebook")} head={tabs} onClose={onClose}>
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

/** The full ledger: everything the anchor row leaves out. */
export function Status({ q, audioAvailable, onClose }: { q: Quiet; audioAvailable: boolean; onClose: () => void }) {
  const { t, course, core } = q;
  const s = core.state;
  const hud = hudValues(course, s, t, Date.now());
  const currency = course.world.currency;
  const rows = [
    t("quiet-st-day", { day: s.day, slot: s.slot, slots: course.world.slotsPerDay }),
    t("quiet-st-wallet", { currency, wallet: s.wallet }),
    t("quiet-st-rent", { currency, rent: course.world.rentPerWeek, days: s.rentLate ? 0 : rentDueInDays(s.day) }) + (s.rentLate ? ` · ${t("quiet-rent-late")}` : ""),
    t("notebook-rank", { rank: hud.rankLabel }),
    s.errand ? t("quiet-st-parcel") : t("quiet-st-no-parcel"),
    t("settings-sound", { sound: t(!audioAvailable ? "settings-sound-none" : s.sound === false ? "settings-sound-off" : "settings-sound-on") }),
  ];
  return (
    <Overlay q={q} title={t("quiet-status")} onClose={onClose}>
      {rows.map((r) => <p key={r}>{r}</p>)}
      <div class="trust">
        {Object.keys(course.world.npcs).map((npc) => <p key={npc}>{t("quiet-st-trust", { npc: t(`npc-${npc}`), trust: s.trust[npc] ?? 0 })}</p>)}
      </div>
    </Overlay>
  );
}

export function Menu({ q, page, onClose, onGames }: { q: Quiet; page: Page; onClose: () => void; onGames: () => void }) {
  const [screen, setScreen] = useState<SettingsScreen>("main");
  const [speed, setSpeed] = useState(page.speed); // its own copy, so a press repaints the row
  const rows = settingsRows(screen, { course: q.course, catalog: page.catalog as CatalogEntry[], state: q.core.state, t: q.t, audioAvailable: page.audioAvailable });
  const title = screen === "main" ? q.t("vn-settings") : screen === "course" ? q.t("settings-pick-course") : q.t("settings-pick-reading");
  return (
    <Overlay q={q} title={title} onClose={onClose}>
      {rows.map((r) => (
        <button key={r.label} type="button" class="row" onClick={() => {
          const a = r.action;
          if (a.kind === "open") setScreen(a.screen);
          else if (a.kind === "back") setScreen("main");
          else if (a.kind === "switch") page.switchTo(a.course, a.learner);
          else q.toggleSound();
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
