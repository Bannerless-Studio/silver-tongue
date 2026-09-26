import { readFileSync } from "node:fs";
import type { Course } from "@silver-tongue/core";
import { fixtureCourse, spacedCourse } from "@silver-tongue/core/testing";

/** Narration and names for the test course, as a learner-language file would give them. */
export const NARRATION = `
place-street = The street
place-street-desc = Bikes and steam.
place-noodle_shop = Noodle shop
place-noodle_shop-desc = Steam everywhere. The cook waves you over.
npc-cook = Cook
scene-intro = Say hello
scene-intro-start = The cook looks up from a steaming pot and wipes her hands on her apron.
scene-intro-end = She hands you an apron.
action-serve = You set down { $count } cups of { $item }.
asked-serve = They wanted { $count } cups of { $item }.
action-repeat = You repeat the word for { $item }.
note-hao-title = 好 means good
note-hao = On its own, 好 agrees.
intro-1 = You arrive with { $currency }{ $wallet } and no words.
intro-2 = An old man on a bench is watching you with open curiosity.
scene-shift = Serve drinks
`;

const ui = () => readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8");

/** The fixture course with the real English UI text. */
export function fixtureWithText(): Course {
  return { ...fixtureCourse(), learnerFtl: ui() + NARRATION };
}

/** The spaced test course with the real English UI text. */
export function spacedWithText(): Course {
  return { ...spacedCourse(), learnerFtl: ui() + NARRATION };
}
