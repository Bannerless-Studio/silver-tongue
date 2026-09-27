import { useState } from "preact/hooks";
import type { CatalogEntry } from "@silver-tongue/core";
import { notebookEntries, settingsRows, type SettingsScreen } from "@silver-tongue/view";
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

export function Notebook({ vn, onClose }: { vn: Vn; onClose: () => void }) {
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
  const rows = settingsRows(screen, { course: vn.course, catalog: page.catalog as CatalogEntry[], state: vn.core.state, t: vn.t, audioAvailable: page.audioAvailable });
  const title = screen === "main" ? vn.t("vn-settings") : screen === "course" ? vn.t("settings-pick-course") : vn.t("settings-pick-reading");
  return (
    <Overlay title={title} onClose={onClose} close={vn.t("web-close")}>
      {rows.map((r) => (
        <button key={r.label} type="button" class="row" onClick={() => {
          const a = r.action;
          if (a.kind === "open") setScreen(a.screen);
          else if (a.kind === "back") setScreen("main");
          else if (a.kind === "switch") page.switchTo(a.course, a.learner);
          else vn.toggleSound();
        }}>{r.label}</button>
      ))}
      {screen === "main" && <button type="button" class="row" onClick={onGames}>{vn.t("vn-games")}</button>}
      {screen === "main" && page.textUrl && <a class="row" href={page.textUrl}>{vn.t("vn-play-text")}</a>}
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
