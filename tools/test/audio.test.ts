import { describe, expect, it } from "vitest";
import { planAudio } from "../src/audio";

describe("planAudio", () => {
  const a = { id: "aaaa", voice: "V", text: "你" };
  const b = { id: "bbbb", voice: "V", text: "好" };

  it("lists clips without a file, and mp3 files nothing needs", () => {
    expect(planAudio([a, b], ["aaaa.mp3", "cccc.mp3", "notes.txt", "dddd.mp3.part"])).toEqual({ missing: [b], unused: ["cccc.mp3"] });
  });

  it("has nothing to do when files and clips match", () => {
    expect(planAudio([a], ["aaaa.mp3"])).toEqual({ missing: [], unused: [] });
  });
});
