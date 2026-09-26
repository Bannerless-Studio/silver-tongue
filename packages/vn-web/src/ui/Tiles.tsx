import type { Vn, VnView } from "../vn";

export function Tiles({ vn, view }: { vn: Vn; view: VnView }) {
  const p = view.phase;
  if (p.kind !== "tiles") return null;
  return (
    <div class="tiles">
      {p.tiles.map((x, i) => (
        <button key={i} type="button" class="tile" disabled={p.placed.includes(i)} onClick={() => vn.placeTile(i)}>
          <span class="key">{i + 1}</span>{x}
        </button>
      ))}
      <button type="button" class="tile tool" aria-label={vn.t("vn-undo")} title={vn.t("vn-undo")} disabled={!p.placed.length} onClick={() => vn.undoTile()}>⌫</button>
      <button type="button" class="tile tool primary" aria-label={vn.t("vn-send")} title={vn.t("vn-send")} disabled={!p.placed.length} onClick={() => vn.sendTiles()}>✓</button>
    </div>
  );
}
