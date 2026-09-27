import type { CatalogEntry, Course, GameState } from "@silver-tongue/core";
import type { SpeechSpeed } from "./audio";
import type { Text } from "./text";

export type SettingsScreen = "main" | "course" | "reading";
export type SettingsAction =
  | { kind: "open"; screen: "course" | "reading" }
  | { kind: "back" }
  | { kind: "switch"; course: string; learner: string }
  | { kind: "sound" }
  | { kind: "speed" };
export interface SettingsRow {
  label: string;
  action: SettingsAction;
}
export interface SettingsContext {
  course: Course;
  catalog: CatalogEntry[];
  state: GameState;
  t: Text;
  audioAvailable: boolean;
  /**
   * Rows only the terminal offers (speed, and a keyboard hint on the Sound row): the web pages
   * share this function but pick speed some other way, so this stays unset for them.
   */
  terminal?: { speed: SpeechSpeed };
}

/** The rows a settings screen shows and what choosing each one does. */
export function settingsRows(screen: SettingsScreen, c: SettingsContext): SettingsRow[] {
  const { course, catalog, state, t } = c;
  const entry = catalog.find((e) => e.id === course.id);
  const languageName = (code: string) => (t.has(`language-${code}`) ? t(`language-${code}`) : code);
  const learnerName = (code: string) => entry?.learnerNames[code] ?? code;
  const current = (yes: boolean) => (yes ? ` ${t("settings-current")}` : "");
  if (screen === "course") {
    return catalog.map((e) => ({
      label: languageName(e.language) + current(e.id === course.id),
      action:
        e.id === course.id ? { kind: "back" } : { kind: "switch", course: e.id, learner: e.learners.includes(course.learner) ? course.learner : e.learners[0] },
    }));
  }
  if (screen === "reading") {
    return (entry?.learners ?? [course.learner]).map((code) => ({
      label: learnerName(code) + current(code === course.learner),
      action: code === course.learner ? { kind: "back" } : { kind: "switch", course: course.id, learner: code },
    }));
  }
  const sound = !c.audioAvailable ? t("settings-sound-none") : state.sound === false ? t("settings-sound-off") : t("settings-sound-on");
  const soundLabel = t("settings-sound", { sound }) + (c.terminal ? ` ${t("settings-sound-hint")}` : "");
  const rows: SettingsRow[] = [
    { label: t("settings-learning", { language: languageName(course.language.code) }), action: { kind: "open", screen: "course" } },
    { label: t("settings-reading", { learner: learnerName(course.learner) }), action: { kind: "open", screen: "reading" } },
    { label: soundLabel, action: { kind: "sound" } },
  ];
  if (c.terminal) rows.push({ label: t("settings-speed", { speed: t(`settings-speed-${c.terminal.speed}`) }), action: { kind: "speed" } });
  return rows;
}
