import { describe, expect, it } from "vitest";
import { createCore, mulberry32, newGame } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { CourseExtra } from "@silver-tongue/view";
import { createQuiet } from "../src/quiet";
import { notebookDocuments } from "../src/notebook";

/** Real core-kept papers plus the two frontend document sources the Book draws. */
function documents(desk: boolean, kept: boolean, reward: boolean) {
  const course = fixtureWithText();
  const extra = course as CourseExtra;
  extra.language.book = true;
  extra.papers = desk ? [{ id: "idcard", kind: "card", lines: [{ id: "name", text: "김민준" }] }] : [];
  extra.scenes[0].exchanges[0].pin = true;
  const state = { ...newGame(course), scenesDone: kept ? { [course.scenes[0].id]: 1 } : {} };
  const q = createQuiet({ course, core: createCore(course, state, { now: () => 1000, rng: mulberry32(1) }), now: () => 1000, lab: false });
  return notebookDocuments({ ...q, bookPapers: () => [...q.bookPapers(), ...(reward ? [{ id: "stall-card", kind: "card" as const, reward: "friend" as const, lines: [{ id: "heading", text: "지우네" }] }] : [])] }, 1000);
}

describe("the Book's document empty state", () => {
  it("says nothing yet only when every displayed source is empty", () => {
    expect(documents(false, false, false)).toMatchObject({ desk: [], kept: [], empty: true });
  });
  it("retains unread desk papers before any core-kept paper exists", () => {
    const result = documents(true, false, false);
    expect(result.desk.map((p) => p.id)).toEqual(["idcard"]);
    expect(result.kept).toEqual([]);
    expect(result.empty).toBe(false);
  });
  it("counts an earned decodable card even when it is the only document", () => {
    expect(documents(false, false, true)).toMatchObject({ desk: [expect.objectContaining({ id: "stall-card" })], kept: [], empty: false });
  });
  it("counts core-kept papers without desk papers or a reward", () => {
    const result = documents(false, true, false);
    expect(result.kept).toHaveLength(1);
    expect(result.desk).toEqual([]);
    expect(result.empty).toBe(false);
  });
});
