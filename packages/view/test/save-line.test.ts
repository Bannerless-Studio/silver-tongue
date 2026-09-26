import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { newGame, serialize } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { decodeSave, encodeSave } from "../src/index";

describe("save line", () => {
  const course = fixtureCourse();
  const state = { ...newGame(course), day: 6, wallet: 31 };

  it("round-trips a save through one line, ignoring spaces and line breaks from copying", async () => {
    const line = await encodeSave(state);
    expect(line).toMatch(/^st1:[A-Za-z0-9+/]+=*$/);
    expect(await decodeSave(`  ${line}\n`, course)).toEqual({ ok: true, state });
    expect(await decodeSave(line.replace(/(.{20})/g, "$1\n"), course)).toEqual({ ok: true, state });
  });

  it("says why a line won't import", async () => {
    expect(await decodeSave("not a save!", course)).toEqual({ ok: false, reason: "not-a-save" });
    expect(await decodeSave("st1:AAAA", course)).toEqual({ ok: false, reason: "not-a-save" });
    expect(await decodeSave(await encodeSave({ ...state, course: "other" }), course)).toEqual({ ok: false, reason: "other-course" });
  });

  it("reads lines made by 0.4.0's Node codec (raw deflate, base64)", async () => {
    const old = "st1:" + deflateRawSync(Buffer.from(serialize(state))).toString("base64");
    expect(await decodeSave(old, course)).toEqual({ ok: true, state });
  });

  it("keeps a long game's line short", async () => {
    const log = Array.from({ length: 500 }, (_, i) => ({ t: i, day: 1, slot: 0, input: { type: "helpWord" as const, word: "w_ni" } }));
    const long = { ...newGame(course), log };
    expect((await encodeSave(long)).length).toBeLessThan(serialize(long).length / 5);
  });
});
