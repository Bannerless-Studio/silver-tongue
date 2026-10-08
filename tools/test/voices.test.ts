import { describe, expect, it } from "vitest";
import { PLAYER_MARK } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import type { WordExtra } from "@silver-tongue/view";
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

  it("gives a form a line uses its own clip, said by the words voice", () => {
    const c = fixtureCourse();
    const v = c.scenes[0].exchanges[0].variants[""];
    const tk = v.npc.tokens[0];
    const surface = v.npc.text.slice(tk.start, tk.end);
    c.words[tk.word] = { ...c.words[tk.word], w: "base-spelling", forms: { [surface]: ["r"] } };
    const clips = assignAudio(c, V, Object.keys(c.words));
    expect((c.words[tk.word] as WordExtra).formAudio).toEqual({ [surface]: [clipId("W", surface)] });
    expect(clips.map((x) => x.id)).toContain(clipId("W", surface));
  });

  it("gives words audio only to the words asked for", () => {
    const c = fixtureCourse();
    assignAudio(c, V, ["w_ni"]);
    expect(c.words.w_ni.audio).toBeDefined();
    expect(c.words.w_hao.audio).toBeUndefined();
  });
});

describe("a word's spoken text", () => {
  it("says a word's `say` text instead of its spelling, so a particle like は is voiced as wa", () => {
    const c = fixtureCourse();
    const clips = assignAudio(c, V, ["w_ni", "w_hao"], { w_ni: "妮" });
    expect(c.words.w_ni.audio).toEqual([clipId("W", "妮")]);
    expect(c.words.w_hao.audio).toEqual([clipId("W", "好")]);
    expect(clips.find((x) => x.id === clipId("W", "妮"))?.text).toBe("妮");
  });
});

describe("voices with pitch and rate", () => {
  // sha1("zh-CN-XiaoxiaoNeural|谢谢")[0..16]: content/audio/zh is named by ids like this one
  const PINNED = "45a75ad3bb46dc3c";
  it("keep a plain voice's clip id exactly as before", () => {
    expect(clipId("zh-CN-XiaoxiaoNeural", "谢谢")).toBe(PINNED);
    expect(clipId({ voice: "zh-CN-XiaoxiaoNeural" }, "谢谢")).toBe(PINNED);
  });
  it("give a pitched or slowed voice its own id, and carry pitch and rate on the clip", () => {
    const low = { voice: "K", pitch: "-10Hz" };
    expect(clipId(low, "こんにちは")).not.toBe(clipId("K", "こんにちは"));
    expect(clipId({ voice: "K", rate: "-10%" }, "こんにちは")).not.toBe(clipId(low, "こんにちは"));
    expect(lineClips("こんにちは。", low)).toEqual([{ id: clipId(low, "こんにちは。"), voice: "K", pitch: "-10Hz", text: "こんにちは。" }]);
  });
  it("let two NPCs in one place share a voice name when pitch or rate differs", () => {
    const w = fixtureCourse().world;
    w.npcs.waiter = { place: "noodle_shop" };
    const v: Voices = { ...V, npcs: { cook: "C", waiter: { voice: "C", pitch: "+10Hz" } } };
    expect(voiceProblems(v, w, fixtureCourse().scenes)).toEqual([]);
    const same: Voices = { ...V, npcs: { cook: "C", waiter: { voice: "C" } } };
    expect(voiceProblems(same, w, fixtureCourse().scenes).join()).toMatch(/both at noodle_shop/);
  });
  it("still refuse the player's exact voice on an NPC", () => {
    const v: Voices = { ...V, player: { voice: "P", pitch: "-5Hz" }, npcs: { cook: { voice: "P", pitch: "-5Hz" } } };
    expect(voiceProblems(v, fixtureCourse().world, fixtureCourse().scenes).join()).toMatch(/uses the player's voice/);
  });
});
