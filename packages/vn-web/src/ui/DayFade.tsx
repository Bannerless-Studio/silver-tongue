import type { Vn, VnView } from "../vn";

/** A new day: black, "Day N" and the night's narration, over the stage until tapped. */
export function DayFade({ vn, view }: { vn: Vn; view: VnView }) {
  const p = view.phase;
  if (p.kind !== "beat" || p.beat.day === undefined) return null;
  return (
    <div class="day-fade" onClick={() => vn.advance()} role="button" aria-label={vn.t("vn-tap")}>
      <div class="day-title">{vn.t("vn-day", { day: p.beat.day })}</div>
      <p>{p.beat.text}</p>
    </div>
  );
}
