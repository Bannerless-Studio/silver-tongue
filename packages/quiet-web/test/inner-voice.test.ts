import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { comboKey, createCore, mulberry32, newGame } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { extra, deskVoiceRule, type VoiceMemory } from "@silver-tongue/view";
import { createQuiet } from "../src/quiet";
import { stageView } from "../src/stage";

const ftl = readFileSync(new URL("../../../content/learner/en/voice-ko.ftl", import.meta.url), "utf8");
function setup() {
  const course = fixtureWithText(); course.language.code = "ko"; extra(course).language.book = true;
  extra(course).language.voice = true;
  extra(course).letters = JSON.parse(readFileSync(new URL("../../../content/languages/ko/letters.json", import.meta.url), "utf8"));
  course.learnerFtl += `\n${ftl}`;
  const core = createCore(course, newGame(course), { now: () => 1000, rng: mulberry32(1) });
  let clock = 1000;
  let memory: VoiceMemory | undefined;
  createQuiet({ course, core, now: () => clock += 1000, papers: { load: () => [], save: () => {}, loadVoice: () => memory, saveVoice: (v) => { memory = v; } } });
  core.send({ type: "goTo", place: course.scenes[0].place });
  // Resume a started scene so all control/beat paths are exercised by the controller.
  core.send({ type: "startScene", scene: course.scenes[0].id });
  const now = () => clock += 1000;
  const active = createQuiet({ course, core, now });
  return { course, core, q: active, now };
}
describe("quiet inner voice", () => {
  it("shows stall and miss thoughts as stage notes below the active line", () => {
    const { core, q } = setup();
    q.stall();
    expect(q.view().backlog.some((b) => b.tone === "voice" && b.text?.startsWith("› "))).toBe(true);
    const run = core.state.run!;
    expect(run.mode).toBe("pick");
    q.choose(run.options.findIndex((key) => key !== comboKey(run.combo)));
    expect(core.state.run!.misses).toBe(1);
    q.choose(core.state.run!.options.findIndex((key) => key !== comboKey(core.state.run!.combo)));
    expect(core.state.run!.misses).toBe(2);
    const stage = stageView(q.view().backlog, q.view().stageFrom);
    expect(stage.exchanges.at(-1)!.direction.some((b) => b.tone === "voice")).toBe(true);
  });
  it("gives the same letter-rule voice to the desk", () => {
    const { q, course } = setup();
    expect(deskVoiceRule(course, "월")).toBe("silent");
    q.deskWrong("월");
    expect(q.view().voice).toContain("Initial ㅇ is silent; the vowel starts the sound.");
  });
});

it("clears desk thoughts after the wrong-rule pool is spent", () => {
  const { q } = setup();
  for (let i = 0; i < 4; i++) { q.deskWrong("월"); expect(q.view().voice).toBeTruthy(); }
  q.deskWrong("월");
  expect(q.view().voice).toBeUndefined();
});
it("persists core progress even when voice presentation saving throws", () => {
  const { course, core, now } = setup();
  const save = vi.fn(() => true);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const q = createQuiet({ course, core, now, save, papers: { load: () => [], save: () => {}, saveVoice: () => { throw new Error("voice failure"); } } });
    save.mockClear(); warn.mockClear();
    expect(() => q.choose(core.state.run!.options.findIndex((key) => key !== comboKey(core.state.run!.combo)))).not.toThrow();
    expect(core.state.run!.misses).toBe(1);
    expect(save).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  } finally { warn.mockRestore(); }
});
