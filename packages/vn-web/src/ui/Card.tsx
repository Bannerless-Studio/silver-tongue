import type { SentenceCard, WordCard } from "@silver-tongue/view";
import type { Vn } from "../vn";

export type CardData = { kind: "word"; card: WordCard } | { kind: "sentence"; card: SentenceCard };

/** What a word or a line means, with a button to hear it. */
export function Card({ vn, data, onClose }: { vn: Vn; data: CardData; onClose: () => void }) {
  const c = data.card;
  const reading = data.kind === "word" ? data.card.readings.join(" ") : data.card.reading;
  const meaning = data.kind === "word" ? data.card.gloss : data.card.meaning;
  return (
    <div class="card-back" onClick={onClose}>
      <div class="card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div class="card-text">{c.text}</div>
        {reading && <div class="card-reading">{reading}</div>}
        <div class="card-meaning">{meaning}</div>
        <div class="card-buttons">
          {c.clips.length > 0 && <button type="button" onClick={() => vn.play(c.clips)}>▶ {vn.t("vn-play-word")}</button>}
          <button type="button" onClick={onClose}>{vn.t("web-close")}</button>
        </div>
      </div>
    </div>
  );
}
