import { papers } from "@silver-tongue/view";
import type { Quiet } from "./quiet";

/** Every document source displayed by the Book: desk/earned decodable documents and core-kept papers. */
export function notebookDocuments(q: Pick<Quiet, "course" | "core" | "t" | "bookPapers">, now: number) {
  const desk = q.bookPapers();
  const kept = papers(q.course, q.core.state, q.t, now);
  return { desk, kept, empty: !desk.length && !kept.length };
}
