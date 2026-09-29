import { anchorRow, reviewTell } from "@silver-tongue/view";
import type { Quiet, QuietView } from "../quiet";

/** The one line always shown: place, day and slot; rent, a repeat shift or missing sound only when they deviate. */
export function Anchor({ q, view, audioAvailable }: { q: Quiet; view: QuietView; audioAvailable: boolean }) {
  const { t, course, core } = q;
  const row = anchorRow(course, core.state, t);
  const currency = course.world.currency;
  const tell = view.scene ? reviewTell(course, view.scene, core.state) : undefined;
  return (
    <header class="anchor">
      <span class="where">{t("quiet-anchor", { place: row.place, day: row.day, part: row.part })}</span>
      <span class="flags">
        {tell?.repeat && <span class="dim">{tell.pays ? t("quiet-repeat-pays", { currency, pays: tell.pays }) : t("quiet-repeat")}</span>}
        {row.rent && (
          <span class="amber">
            {row.rent.late ? t("quiet-rent-late") : t("quiet-rent", { currency, rent: row.rent.amount, days: row.rent.dueInDays, wallet: row.rent.wallet })}
          </span>
        )}
        {!audioAvailable && <span class="dim">{t("quiet-no-audio")}</span>}
      </span>
    </header>
  );
}
