import { useEffect, useState } from "preact/hooks";
import type { Text } from "@silver-tongue/view";

const QUERY = "(orientation: portrait) and (pointer: coarse)";

/** On a phone held upright: a hint to turn it, which the player can dismiss for this visit. */
export function RotateHint({ t }: { t: Text }) {
  const [portrait, setPortrait] = useState(() => matchMedia(QUERY).matches);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const m = matchMedia(QUERY);
    const on = () => setPortrait(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  if (!portrait || dismissed) return null;
  return (
    <div class="rotate-hint" role="status">
      <span class="rotate-icon" aria-hidden="true">⟳</span>
      <p>{t("vn-turn-phone")}</p>
      <button type="button" onClick={() => setDismissed(true)}>{t("vn-dismiss")}</button>
    </div>
  );
}
