import { deskPapers, papers } from "@silver-tongue/view";
import type { Quiet } from "./quiet";

/** Every document source displayed by the Book, including discoveries outside core's pinned papers. */
export function notebookDocuments(q: Pick<Quiet, "course" | "core" | "t" | "friendClaim">, now: number) {
  const desk = deskPapers(q.course);
  const kept = papers(q.course, q.core.state, q.t, now);
  const photo = q.friendClaim() === true;
  return { desk, kept, photo, empty: !desk.length && !kept.length && !photo };
}
