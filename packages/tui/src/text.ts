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

/** Message ids the TUI uses. The content checker fails a course that lacks any of them. */
export const UI_KEYS = [
  "hud",
  "rank-0",
  "rank-1",
  "rank-2",
  "rank-3",
  "rank-4",
  "menu-title",
  "menu-talk",
  "menu-go",
  "menu-sleep",
  "menu-quit",
  "keys-explore",
  "keys-pick",
  "keys-tiles",
  "keys-help",
  "help-title",
  "tiles-answer",
  "mismatch",
  "rephrased",
  "wallet-change",
  "reason-wages",
  "reason-mixup",
  "reason-food",
  "reason-rent",
  "trust-up",
  "scene-done",
  "unlocked",
  "rank-up",
  "day-ended",
  "rejected",
  "notice-bad-save",
];
