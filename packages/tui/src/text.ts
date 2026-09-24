import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";

export type Text = (id: string, args?: Record<string, FluentVariable>) => string;

/** Learner-language text. A missing message shows its id, so gaps are visible, never fatal. */
export function makeText(ftl: string, locale = "en"): Text {
  const bundle = new FluentBundle(locale, { useIsolating: false });
  bundle.addResource(new FluentResource(ftl));
  return (id, args) => {
    const msg = bundle.getMessage(id);
    // Passing an errors array makes Fluent render problems inline ({$day}) instead of throwing.
    return msg?.value ? bundle.formatPattern(msg.value, args ?? {}, []) : id;
  };
}

/** Why the core refused an input (inputRejected.reason); each has a `reject-<code>` message. */
export const REJECT_CODES = [
  "unknown-scene",
  "in-scene",
  "wrong-place",
  "locked",
  "no-slots",
  "stale-run",
  "no-pick",
  "bad-choice",
  "no-tiles",
  "bad-tile",
  "not-linked",
  "unknown-word",
];

/**
 * Message ids the TUI uses, with the variables it passes to each.
 * The course build fails a learner language that lacks any of them or uses other variables.
 */
export const UI_KEYS: Record<string, string[]> = {
  hud: ["day", "slot", "slots", "currency", "wallet", "rank"],
  "rank-0": [],
  "rank-1": [],
  "rank-2": [],
  "rank-3": [],
  "rank-4": [],
  "menu-title": [],
  "menu-talk": ["npc", "scene"],
  "menu-go": ["place"],
  "menu-sleep": [],
  "menu-quit": [],
  "keys-explore": [],
  "keys-pick": [],
  "keys-tiles": [],
  "keys-help": [],
  "help-title": [],
  "tiles-answer": [],
  mismatch: [],
  rephrased: [],
  "wallet-change": ["sign", "currency", "amount", "reason"],
  "reason-wages": [],
  "reason-mixup": [],
  "reason-food": [],
  "reason-rent": [],
  "trust-up": ["npc", "trust"],
  "scene-done": ["currency", "earned"],
  unlocked: ["scene"],
  "rank-up": ["rank"],
  "day-ended": ["day"],
  "notice-bad-save": [],
  ...Object.fromEntries(REJECT_CODES.map((c) => [`reject-${c}`, []])),
};

/** Every UI message that is missing or can't be formatted with the variables the TUI passes. */
export function uiTextProblems(ftl: string, locale: string): string[] {
  const bundle = new FluentBundle(locale, { useIsolating: false });
  bundle.addResource(new FluentResource(ftl));
  const problems: string[] = [];
  for (const [id, vars] of Object.entries(UI_KEYS)) {
    const msg = bundle.getMessage(id);
    if (!msg?.value) {
      problems.push(`learner text: missing "${id}"`);
      continue;
    }
    const errors: Error[] = [];
    bundle.formatPattern(msg.value, Object.fromEntries(vars.map((v) => [v, 1])), errors);
    for (const e of errors) problems.push(`learner text "${id}": ${e.message}`);
  }
  return problems;
}
