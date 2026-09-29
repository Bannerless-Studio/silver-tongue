import { useState } from "preact/hooks";
import { personView, type PersonTip } from "@silver-tongue/view";
import type { Quiet } from "../quiet";
import { partLabel } from "./Anchor";
import { Overlay } from "./Overlays";

type Tab = "tips" | "history" | "words";

export const trustBar = (n: number) => "█".repeat(n) + "░".repeat(5 - n);

/** A conversation still to have: ↻ work that can be done again, ◇ a one-off; lit while open, dim until then. */
function Tip({ tip }: { tip: PersonTip }) {
  return (
    <div class="p-tip">
      <p>
        <span class={tip.open ? (tip.repeat ? "cyan" : "amber") : "dim"}>{tip.repeat ? "↻" : "◇"}</span>{" "}
        <span class={tip.open ? "" : "dim"}>{tip.label}</span>
      </p>
      {tip.needs.map((n) => (
        <p key={n.text} class="p-sub dim"><span class={n.done ? "green" : "amber"}>{n.done ? "✓" : "·"}</span> {n.text}</p>
      ))}
      {tip.gains && <p class="p-sub dim">{tip.gains}</p>}
    </div>
  );
}

/**
 * One person: who they are and how well they know you, then tabs for what to do next with them,
 * the conversations had (one open at a time) and their words, heard and not yet.
 */
export function Person({ q, npc, onBack, onClose }: { q: Quiet; npc: string; onBack: () => void; onClose: () => void }) {
  const { t, course, core } = q;
  const [tab, setTab] = useState<Tab>("tips");
  const [openTalk, setOpenTalk] = useState(0);
  const p = personView(course, core.state, t, npc, Date.now());
  const player = core.state.player ?? t("quiet-you");
  const total = p.words.heard.length + p.words.notYet.length;
  const tabs: { id: Tab; label: string; off?: boolean }[] = [
    { id: "tips", label: t("quiet-p-tab-tips") },
    { id: "history", label: t("quiet-p-tab-history", { count: p.talks.length }), off: !p.met },
    { id: "words", label: t("quiet-p-tab-words", { heard: p.words.heard.length, total }) },
  ];
  const back = <button type="button" class="dim" onClick={onBack}>{t("quiet-p-back")}</button>;
  return (
    <Overlay q={q} title={p.name} head={back} onClose={onClose} hideTitle>
      <div class="p-head">
        <p><span class={p.met ? "p-name cyan" : "p-name"}>{p.name}</span> <span class="dim">{p.place}</span></p>
        {p.desc && <p>{p.desc}</p>}
        <p class="dim">{p.met ? <><span class="cyan">{trustBar(p.trust)}</span> {t("quiet-p-trust", { trust: p.trust })}</> : t("quiet-p-not-met")}</p>
      </div>
      <nav class="tabs p-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === tab} disabled={x.off} class={x.id === tab ? "tab on" : "tab"} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>
      {tab === "tips" && (
        <div class="p-tips">
          {p.where && <p class="dim">{p.where}</p>}
          {p.tips.length ? p.tips.map((x) => <Tip key={x.label} tip={x} />) : <p class="dim">{t("quiet-p-no-tips")}</p>}
        </div>
      )}
      {tab === "history" && (
        <div class="p-talks">
          {p.talks.length ? p.talks.map((talk, i) => (
            <div key={i} class="p-talk">
              <button type="button" class="p-talk-head" aria-expanded={i === openTalk} onClick={() => setOpenTalk(i === openTalk ? -1 : i)}>
                <span class="dim">{i === openTalk ? "▾" : "▸"}</span>
                <span class="p-talk-title">{talk.title}</span>
                {talk.earned > 0 && <span class="green">+{course.world.currency}{talk.earned}</span>}
              </button>
              <p class="p-sub dim">{t("quiet-p-when", { day: talk.day, part: partLabel(t, talk.part) })}</p>
              {i === openTalk && (
                <div class="p-lines">
                  {talk.lines.map((l, j) => (
                    <div key={j}>
                      <p><span class={l.who === "npc" ? "cyan" : "amber"}>{l.who === "npc" ? p.name : player}:</span> {l.text}</p>
                      {l.meaning && <p class="dim p-small">{l.meaning}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) : <p class="dim">{t("quiet-p-no-talks")}</p>}
        </div>
      )}
      {tab === "words" && (
        <div class="p-words">
          <div>
            <p class="dim">{t("quiet-p-heard", { count: p.words.heard.length })}</p>
            {p.words.heard.map((w) => (
              <div key={w.word} class="p-word">
                <p><span class={w.shaky ? "w shaky" : ""}>{w.text}</span> <span class="dim p-small">{w.reading}</span></p>
                <p class="dim p-small">{w.gloss}</p>
              </div>
            ))}
          </div>
          <div class="p-later">
            <p class="dim">{t("quiet-p-not-yet", { count: p.words.notYet.length })}</p>
            {p.words.notYet.map((w) => (
              <div key={w.word} class="p-word">
                <p>{w.text} <span class="dim p-small">{w.reading}</span></p>
                <p class="dim p-small">{w.gloss}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
}
