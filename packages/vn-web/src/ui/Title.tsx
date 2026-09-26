import type { Text } from "@silver-tongue/view";
import title from "../art/title.svg";

export function Title({ t, version, courses, hasSave, onContinue, onNew, error }: {
  t: Text; version: string; courses?: { label: string; pick: () => void }[]; hasSave: boolean; onContinue: () => void; onNew: () => void; error?: string;
}) {
  return (
    <div class="stage title-screen">
      <div class="bg" dangerouslySetInnerHTML={{ __html: title }} />
      <div class="title-card">
        <h1>Silver Tongue</h1>
        <p class="tagline">{error ? "" : t("vn-tagline")}</p>
        {error && <p class="error">{error}</p>}
        {courses ? (
          <>
            <p class="muted">{t("start-title")}</p>
            {courses.map((c) => <button key={c.label} type="button" class="title-button" onClick={c.pick}>{c.label}</button>)}
          </>
        ) : !error && (
          <>
            {hasSave && <button type="button" class="title-button primary" onClick={onContinue}>{t("vn-continue")}</button>}
            <button type="button" class={`title-button${hasSave ? "" : " primary"}`} onClick={onNew}>{t("vn-new-game")}</button>
          </>
        )}
      </div>
      <span class="version">v{version}</span>
    </div>
  );
}
