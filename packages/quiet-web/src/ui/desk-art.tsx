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

/** The drawing for a paper kind; unknown kinds get the plain bill slip. */
export function DeskArt({ kind, title, lang }: { kind: string; title: string; lang: string }) {
  const rows = ART[kind] ?? ART.bill!;
  const out: ComponentChildren[] = [];
  rows.forEach((row, i) => {
    const at = row.indexOf(T);
    if (at < 0) return out.push(row + "\n");
    out.push(row[0]!, <span key={i} class="art-title" lang={lang}>{title}</span>, row[row.length - 1]!, "\n");
  });
  return <pre class={`desk-art art-${kind}`} aria-hidden="true">{out}</pre>;
}
