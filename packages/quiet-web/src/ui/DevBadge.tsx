// Lab page only (see dev.ts): the screen number and a box to jump to another. A plain literal, not a UI string: players never see it.
import { useEffect, useState } from "preact/hooks";
import { screenOf } from "../dev";
import type { Quiet } from "../quiet";
import { useQuiet } from "./use-quiet";

export function DevBadge({ q, jump }: { q: Quiet; jump: (n: number) => void }) {
  useQuiet(q); // re-read on every change of the game
  const [, tick] = useState(0);
  // The crawl becoming the name screen is the Opening's own state: look at the page now and then.
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 400);
    return () => clearInterval(id);
  }, []);
  const [typed, setTyped] = useState("");
  const n = screenOf(q, !!document.querySelector(".name-screen"));
  const go = (e: Event) => {
    e.preventDefault();
    const to = Number.parseInt(typed, 10);
    if (to >= 1) jump(to);
    setTyped("");
  };
  return (
    <form class="dev-badge" onSubmit={go}>
      <label>
        screen {n}
        {" "}
        <input
          inputMode="numeric" value={typed} aria-label="jump to screen" placeholder="→"
          onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
          // Keys typed here are for this box only: the game's shortcuts and the desk's Enter must not hear them.
          onKeyDown={(e) => e.stopPropagation()}
        />
      </label>
    </form>
  );
}
