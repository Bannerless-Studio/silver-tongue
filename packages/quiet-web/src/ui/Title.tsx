import type { Text } from "@silver-tongue/view";

export function Title({ t, version, courses, hasSave, onContinue, onNew, error }: {
  t: Text; version: string; courses?: { label: string; pick: () => void }[]; hasSave: boolean; onContinue: () => void; onNew: () => void; error?: string;
}) {
  return (
    <div class="term title">
      <p class="brand">silver-tongue <span class="dim">v{version}</span></p>
      {error ? <p class="bad">{error}</p> : <p class="dim">{t("vn-tagline")}</p>}
      {courses ? (
        <>
          <p>{t("start-title")}</p>
          {courses.map((c, i) => <button key={c.label} type="button" class="opt" onClick={c.pick}><span class="n">{i + 1}</span>{c.label}</button>)}
        </>
      ) : !error && (
        <>
          {/* Absence said plainly: a fresh day 1 never passes for a lost save. */}
          {hasSave ? <button type="button" class="opt" onClick={onContinue}><span class="n">›</span>{t("vn-continue")}</button> : <p class="dim">{t("quiet-no-save")}</p>}
          <button type="button" class="opt" onClick={onNew}><span class="n">›</span>{t("vn-new-game")}</button>
        </>
      )}
    </div>
  );
}
