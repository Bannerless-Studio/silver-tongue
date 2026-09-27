import type { Vn, VnView } from "../vn";

/**
 * Where you can go: one quiet row per thing, numbered, travel marked with an arrow, and what you
 * cannot afford greyed out with the reason already in words. It sits under the stage, not over it.
 */
export function PlaceMenu({ vn, view }: { vn: Vn; view: VnView }) {
  if (view.phase.kind !== "explore") return null;
  return (
    <div class="place-menu">
      {view.phase.waiting.map((w) => <div key={w} class="place-item waiting" aria-disabled="true">{w}</div>)}
      {view.phase.menu.map((m, i) => (
        <button key={i} type="button" class={`place-item kind-${m.kind}`} onClick={() => vn.choose(i)}>
          <span class="key">{i + 1}</span>{m.kind === "go" ? "→ " : ""}{m.label}
        </button>
      ))}
    </div>
  );
}
