import { describe, expect, it } from "vitest";
import { newGame } from "../src/core";
import { parseSave, serialize } from "../src/save";
import { fixtureCourse } from "../src/testing/fixture";

describe("save", () => {
  const course = fixtureCourse();

  it("round-trips a game", () => {
    const s = newGame(course);
    expect(parseSave(serialize(s), course)).toEqual({ ok: true, state: s });
  });

  it("rejects broken or foreign saves with a reason", () => {
    expect(parseSave("{", course)).toEqual({ ok: false, reason: "not-json" });
    expect(parseSave("[]", course)).toEqual({ ok: false, reason: "not-object" });
    const s = newGame(course);
    expect(parseSave(serialize({ ...s, v: 2 as 1 }), course)).toEqual({ ok: false, reason: "version" });
    expect(parseSave(serialize({ ...s, course: "other" }), course)).toEqual({ ok: false, reason: "other-course" });
    expect(parseSave(serialize({ ...s, place: "moon" }), course)).toEqual({ ok: false, reason: "bad-place" });
    expect(parseSave(serialize({ ...s, words: [] as never }), course)).toEqual({ ok: false, reason: "bad-words" });
  });
});
