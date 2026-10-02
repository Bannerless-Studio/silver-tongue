import { anchorRow, bookOn, reviewTell, type DayPart, type Text } from "@silver-tongue/view";
import type { Quiet, QuietView } from "../quiet";

/** The part of the day as a plain glyph, a circle filling as the day goes: no colour emoji in the terminal's look. */
const PART_GLYPH: Record<DayPart, string> = { morning: "○", midday: "◔", afternoon: "◑", evening: "◕", night: "●" };

export const partLabel = (t: Text, part: DayPart) => `${PART_GLYPH[part]} ${t(`day-part-${part}`)}`;

/** The one line always shown: place, day and part of the day (with the Book, the day only beside rent); rent, a repeat shift or missing sound only when they deviate. */
export function Anchor({ q, view, audioAvailable }: { q: Quiet; view: QuietView; audioAvailable: boolean }) {
  const { t, course, core } = q;
  const row = anchorRow(course, core.state, t);
  const currency = course.world.currency;
  const tell = view.scene ? reviewTell(course, view.scene, core.state) : undefined;
  return (
    <header class="anchor">
      {/* With the Book the day's number joins only with rent, the one thing counted in days. */}
      <span class="where">{t(bookOn(course) && !row.rent ? "quiet-anchor-time" : "quiet-anchor", { place: q.placeLabel(), day: row.day, part: partLabel(t, row.part) })}</span>
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
