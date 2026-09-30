import type { ComponentChildren } from "preact";

/** Desk card drawings: each paper kind is a small monospace picture of the object, 20 columns wide, with the
 * paper's title set into its own line (the frame rows never depend on the title's width: Hangul is double-width). */
const T = "@"; // the row that carries the title
const ART: Record<string, string[]> = {
  // ID card: photo box with a head-and-shoulders portrait, field rules beside it.
  card: [
    "╭──────────────────╮",
    `│${T}│`,
    "├──────────────────┤",
    "│ ┌──────┐         │",
    "│ │  ▄▄  │ ─────── │",
    "│ │ ▐██▌ │         │",
    "│ │▗████▖│ ─────   │",
    "│ └──────┘ ░░░░░░  │",
    "╰──────────────────╯",
  ],
  // Folded newspaper: big masthead band, double rule, columns of print, a fold crease.
  masthead: [
    "┏━━━━━━━━━━━━━━━━━━┓",
    `┃${T}┃`,
    "┣━━━━━━━━━━━━━━━━━━┫",
    "┃══════════════════┃",
    "┃ ▄▄▄▄▄▄▄ ┆ ·······┃",
    "┃ ─────── ┆ ───────┃",
    "┃ ─────── ┆ ─────  ┃",
    "┠┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┨",
    "┃ ───     ┆ ───────┃",
    "┃ ─────── ┆ ──     ┃",
    "┗━━━━━━━━━━━━━━━━━━┛",
  ],
  // Rent bill: torn top and bottom, header stripe, label rules, a boxed amount left blank.
  bill: [
    " ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌",
    `│${T}│`,
    "│ ───────  ─────   │",
    "│ ────             │",
    "│ ┌──────────────┐ │",
    "│ │    ······    │ │",
    "│ └──────────────┘ │",
    " ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌",
  ],
};

/** The drawing for a paper kind; unknown kinds get the plain bill slip. Box-drawing glyphs come from fallback fonts
 * whose advance differs from the mono cell, so a row is not laid out by character count: its two edge glyphs are
 * pinned to the sides of a fixed-width row and the middle fills the space between (rules are made long and
 * clipped; content stays left-anchored). The right edges then line up whatever the glyph widths are. */
export function DeskArt({ kind, title, lang }: { kind: string; title: string; lang: string }) {
  const rows = ART[kind] ?? ART.bill!;
  return (
    <pre class={`desk-art art-${kind}`} aria-hidden="true">
      {rows.map((row, i) => {
        const left = row[0]!;
        const right = row[row.length - 1]!;
        const mid = row.slice(1, -1);
        let inner: ComponentChildren;
        if (mid === T) inner = <span class="art-title" lang={lang}>{title}</span>;
        // A rule (or a torn edge) starts right after the edge glyph: repeat it well past the row and let it clip.
        else if (mid[0] !== " ") inner = mid.repeat(4);
        else inner = mid;
        return (
          <span key={i} class="art-row">
            <span class="art-edge">{left}</span>
            <span class="art-mid">{inner}</span>
            <span class="art-edge">{right}</span>
          </span>
        );
      })}
    </pre>
  );
}
