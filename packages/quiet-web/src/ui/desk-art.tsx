/** Desk card drawings: each paper kind is a small picture of the object built from CSS boxes (borders, fills, flex),
 * never from characters, so nothing depends on a font's glyph widths. Only the paper's title is text. The lines use
 * the drawing's colour (`currentColor`), so the card states (pulse / unread / read) tint the whole picture. */
function Title({ title, lang }: { title: string; lang: string }) {
  return <div class="art-title" lang={lang}>{title}</div>;
}

/** Faceless head-and-shoulders silhouette. */
function Portrait() {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
      <circle cx="20" cy="15" r="7" fill="currentColor" />
      <path d="M5 40 C5 27 12 24 20 24 C28 24 35 27 35 40 Z" fill="currentColor" />
    </svg>
  );
}

const Rule = ({ w = 100 }: { w?: number }) => <i class="art-rule" style={{ width: `${w}%` }} />;

/** The drawing for a paper kind; unknown kinds get the plain bill slip. */
export function DeskArt({ kind, title, lang }: { kind: string; title: string; lang: string }) {
  const k = kind === "card" || kind === "masthead" ? kind : "bill";
  let body;
  if (k === "card") {
    body = (
      <>
        <Title title={title} lang={lang} />
        <div class="art-card-body">
          <div class="art-photo"><Portrait /></div>
          <div class="art-fields">
            <Rule />
            <Rule w={70} />
            <i class="art-hatch" />
          </div>
        </div>
      </>
    );
  } else if (k === "masthead") {
    body = (
      <>
        <Title title={title} lang={lang} />
        <i class="art-double" />
        <div class="art-cols">
          <div class="art-col"><i class="art-bar" /><Rule /><Rule /></div>
          <div class="art-col"><i class="art-dots" /><Rule /><Rule w={70} /></div>
        </div>
        <i class="art-crease" />
        <div class="art-cols">
          <div class="art-col"><Rule w={40} /><Rule /></div>
          <div class="art-col"><Rule /><Rule w={30} /></div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Title title={title} lang={lang} />
        <div class="art-labels"><Rule w={55} /><Rule w={35} /></div>
        <div class="art-amount"><i class="art-dots" /></div>
      </>
    );
  }
  return <div class={`desk-art art-${k}`} aria-hidden="true">{body}</div>;
}
