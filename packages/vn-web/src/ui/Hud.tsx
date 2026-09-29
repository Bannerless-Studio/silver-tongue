import { bookOn, hudValues, type DayPart } from "@silver-tongue/view";

/** The part of the day, drawn in the scene's colours. */
const PART_ICON: Record<DayPart, string> = { morning: "🌅", midday: "☀️", afternoon: "🌤️", evening: "🌇", night: "🌙" };
import type { Vn, VnView } from "../vn";

export function Hud({ vn, view, onOpen }: { vn: Vn; view: VnView; onOpen: (o: "notebook" | "backlog" | "menu") => void }) {
  const h = hudValues(vn.course, vn.core.state, vn.t, Date.now());
  const soundOff = vn.core.state.sound === false;
  return (
    <div class="hud">
      <span class="hud-day">{vn.t("vn-day", { day: h.day })}</span>
      <span class="hud-part">{PART_ICON[h.part]} {vn.t(`day-part-${h.part}`)}</span>
      <span class="hud-wallet">
        {h.currency}{h.wallet}
        {view.floats.map((f) => (
          <span key={f.id} class={`float ${f.delta > 0 ? "up" : "down"}`}>{f.delta > 0 ? "+" : "−"}{h.currency}{Math.abs(f.delta)}</span>
        ))}
      </span>
      <span class="hud-rank">{h.rankLabel}</span>
      {h.parcel && <span class="badge" title={vn.t("vn-parcel")}>📦</span>}
      {h.rentLate && <span class="badge warn">{vn.t("vn-rent-late")}</span>}
      <span class="hud-buttons">
        <button type="button" aria-label={vn.t("vn-sound")} title={vn.t("vn-sound")} onClick={() => vn.toggleSound()}>{soundOff ? "♪̸" : "♪"}</button>
        <button type="button" aria-label={vn.t(bookOn(vn.course) ? "vn-book" : "vn-notebook")} title={vn.t(bookOn(vn.course) ? "vn-book" : "vn-notebook")} onClick={() => onOpen("notebook")}>✎</button>
        <button type="button" aria-label={vn.t("vn-backlog")} title={vn.t("vn-backlog")} onClick={() => onOpen("backlog")}>⟲</button>
        <button type="button" aria-label={vn.t("vn-menu")} title={vn.t("vn-menu")} onClick={() => onOpen("menu")}>☰</button>
      </span>
    </div>
  );
}
