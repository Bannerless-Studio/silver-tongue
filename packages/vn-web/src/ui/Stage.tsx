import type { Art } from "../art";
import type { Cue, Vn, VnView } from "../vn";

const MARK: Partial<Record<Cue, string>> = { puzzled: "?", pleased: "!" };

function Silhouette({ vn, svg, cue, x, tint, rim, small, name, onTalk }: {
  vn: Vn; svg: string; cue: Cue; x: number; tint: string; rim: string; small?: boolean; name: string; onTalk?: () => void;
}) {
  const style = { left: `${x * 100}%`, color: tint, "--rim": rim } as Record<string, string>;
  const body = (
    <>
      <span class="sil-body" dangerouslySetInnerHTML={{ __html: svg }} />
      {MARK[cue] && <span class="sil-mark" aria-hidden="true">{MARK[cue]}</span>}
    </>
  );
  return onTalk ? (
    <button type="button" class={`sil small cue-${cue}`} style={style} aria-label={name} title={name} onClick={onTalk}>{body}</button>
  ) : (
    <div class={`sil${small ? " small" : ""} cue-${cue}`} style={style} aria-label={name} role="img">{body}</div>
  );
}

/** The backdrop and the people on it: one centred in a scene, or everyone free to talk while exploring. */
export function Stage({ vn, view, art }: { vn: Vn; view: VnView; art: Art }) {
  const place = art.place(view.place, vn.t(`place-${view.place}`));
  const present =
    view.phase.kind === "explore"
      ? [...new Set(view.phase.menu.flatMap((m) => (m.kind === "talk" || m.kind === "mentor" ? [m.npc] : [])))]
      : [];
  return (
    <div class="scene">
      <div class="bg" key={view.place} dangerouslySetInnerHTML={{ __html: place.svg }} />
      {view.npc ? (
        <Silhouette vn={vn} svg={art.npc(view.npc)} cue={view.cue} x={0.5} tint={place.tint} rim={place.rim} name={vn.t(`npc-${view.npc}`)} />
      ) : (
        present.map((npc) => (
          <Silhouette
            key={npc} vn={vn} svg={art.npc(npc)} cue="listen" small x={art.spot(view.place, npc, present)}
            tint={place.tint} rim={place.rim} name={vn.t(`npc-${npc}`)} onTalk={() => vn.talkTo(npc)}
          />
        ))
      )}
    </div>
  );
}
