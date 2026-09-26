import { describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { assignAudio, clipId, lineClips, voiceProblems, type Voices } from "../src/voices";

const V: Voices = { engine: "edge-tts", player: "P", words: "W", npcs: { cook: "C" } };

describe("clip ids", () => {
  it("are 16 hex characters that depend on voice and text", () => {
    expect(clipId("C", "你好")).toMatch(/^[0-9a-f]{16}$/);
    expect(clipId("C", "你好")).toBe(clipId("C", "你好"));
    expect(clipId("C", "你好")).not.toBe(clipId("P", "你好"));
    expect(clipId("C", "你好")).not.toBe(clipId("C", "你好。"));
  });
});

describe("lineClips", () => {
  it("is one clip for a line without the name", () => {
    expect(lineClips("你好。", "C")).toEqual([{ id: clipId("C", "你好。"), voice: "C", text: "你好。" }]);
  });

  it("splits at the player's name", () => {
    expect(lineClips(`你好，${PLAYER_MARK}，你好吗？`, "C").map((c) => c.text)).toEqual(["你好，", "，你好吗？"]);
  });

  it("skips a part that is empty or only punctuation", () => {
    expect(lineClips(`我叫${PLAYER_MARK}。`, "P").map((c) => c.text)).toEqual(["我叫"]);
    expect(lineClips(`${PLAYER_MARK}！`, "P")).toEqual([]);
  });
});

describe("voiceProblems", () => {
  it("passes a voice per NPC", () => {
    const c = fixtureCourse();
    expect(voiceProblems(V, c.world, c.scenes)).toEqual([]);
  });

  it("reports an NPC without a voice, the player's voice on an NPC, and two NPCs in one place sharing one", () => {
    const w = fixtureCourse().world;
    w.npcs.waiter = { place: "noodle_shop" };
    expect(voiceProblems({ ...V, npcs: { cook: "C" } }, w, [])).toContain('voices: npc "waiter" has no voice');
    expect(voiceProblems({ ...V, npcs: { cook: "P", waiter: "X" } }, w, [])).toContain(`voices: npc "cook" uses the player's voice`);
    expect(voiceProblems({ ...V, npcs: { cook: "C", waiter: "C" } }, w, [])).toContain('voices: "cook" and "waiter" are both at noodle_shop with voice C');
  });
});

describe("assignAudio", () => {
  it("gives NPC lines the NPC's voice, replies and alts the player's, words the words voice, reactions one clip per NPC with a scene", () => {
    const c = fixtureCourse();
    const clips = assignAudio(c, V, Object.keys(c.words));
    const v = c.scenes[0].exchanges[0].variants[""];
    expect(v.npc.audio).toEqual([clipId("C", v.npc.text)]);
    expect(v.reply.audio).toEqual([clipId("P", v.reply.text)]);
    expect(v.alts![0].audio).toEqual([clipId("P", v.alts![0].text)]);
    const order = Object.values(c.scenes[1].exchanges[0].variants)[0];
    expect(order.rephrase!.audio).toEqual([clipId("C", order.rephrase!.text)]);
    expect(c.words.w_ni.audio).toEqual([clipId("W", "你")]);
    expect(c.reactionAudio!["wrong-generic"]).toEqual({ cook: [clipId("C", c.reactions["wrong-generic"].text)] });
    const ids = clips.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain(clipId("W", "你"));
  });

  it("gives words audio only to the words asked for", () => {
    const c = fixtureCourse();
    assignAudio(c, V, ["w_ni"]);
    expect(c.words.w_ni.audio).toBeDefined();
    expect(c.words.w_hao.audio).toBeUndefined();
  });
});
