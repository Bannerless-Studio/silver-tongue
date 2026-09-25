import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";
import { REJECT_REASONS, WALLET_REASONS } from "@silver-tongue/core";

export type Text = ((id: string, args?: Record<string, FluentVariable>) => string) & {
  /** Whether the text has this message: for optional text such as scene narration. */
  has(id: string): boolean;
};

/** Learner-language text. A missing message shows its id, so gaps are visible, never fatal. */
export function makeText(ftl: string, locale = "en"): Text {
  const bundle = new FluentBundle(locale, { useIsolating: false });
  bundle.addResource(new FluentResource(ftl));
  const t = (id: string, args?: Record<string, FluentVariable>) => {
    const msg = bundle.getMessage(id);
    // Passing an errors array makes Fluent render problems inline ({$day}) instead of throwing.
    return msg?.value ? bundle.formatPattern(msg.value, args ?? {}, []) : id;
  };
  return Object.assign(t, { has: (id: string) => !!bundle.getMessage(id)?.value });
}

/**
 * Message ids the TUI uses, with the variables it passes to each.
 * The course build fails a learner language that lacks any of them or uses other variables.
 */
export const UI_KEYS: Record<string, string[]> = {
  hud: ["day", "slot", "slots", "currency", "wallet", "rank", "rentLate"],
  "rank-0": [],
  "rank-1": [],
  "rank-2": [],
  "rank-3": [],
  "rank-4": [],
  "menu-title": [],
  "menu-talk": ["npc", "scene"],
  "menu-go": ["place"],
  "menu-mentor": ["npc"],
  "cost-slot": [],
  "note-hint": ["npc"],
  "mentor-nothing": ["npc"],
  "menu-sleep": [],
  "menu-quit": [],
  "keys-explore": ["keys"],
  "keys-pick": ["keys"],
  "keys-tiles": ["keys"],
  "keys-help": ["keys"],
  "keys-notebook": [],
  "notebook-progress": ["stage", "known", "total", "heard"],
  "notebook-empty": [],
  "notebook-elsewhere": [],
  "notebook-notes": [],
  "keys-help-sentence": ["keys"],
  "help-sentence": [],
  "help-in-replies": [],
  "help-title": [],
  "reply-title": [],
  "tiles-answer": [],
  you: [],
  mismatch: [],
  rephrased: [],
  "wallet-change": ["sign", "currency", "amount", "reason"],
  ...Object.fromEntries(WALLET_REASONS.map((r) => [`reason-${r}`, []])),
  "trust-up": ["npc", "trust"],
  "scene-done": ["currency", "earned"],
  unlocked: ["scene"],
  "rank-up": ["rank"],
  "day-ended": ["day"],
  "notice-bad-save": [],
  "notice-read-only": [],
  "resume-title": [],
  "resume-item": ["day", "place", "currency", "wallet", "done", "date"],
  "resume-ask": [],
  "resume-none": [],
  ...Object.fromEntries(REJECT_REASONS.map((c) => [`reject-${c}`, []])),
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
