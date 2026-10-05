import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { voiceOn, VOICE_POOLS } from "@silver-tongue/view";
import { buildCourse } from "../src/build-course";
import { messageIds } from "../src/fluent";
import { voiceProblems } from "../src/check";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));
describe("inner voice content contract", () => {
  const { course, errors } = buildCourse(CONTENT, "ko-seoul");
  it("loads the voice and optional per-exchange explanations", () => {
    expect(errors).toEqual([]);
    expect(voiceOn(course!)).toBe(true);
    expect(course!.learnerFtl).toContain("voice-first-miss-1");
    const scene = course!.scenes.find((s) => s.id === "street-again")!;
    expect((Object.values(scene.exchanges[0].variants)[0] as { why?: string }).why).toBe("Do I know Korean?");
  });
  it("requires four contiguous variants in every pool", () => {
    const ids = new Set(messageIds(course!.learnerFtl, "learner"));
    expect(voiceProblems(course!, ids)).toEqual([]);
    for (const pool of VOICE_POOLS) {
      const missing = new Set(ids); missing.delete(`voice-${pool}-4`);
      expect(voiceProblems(course!, missing)).toContain(`voice: ${pool} needs at least 4 variants`);
    }
    const gap = new Set(ids); gap.delete("voice-stall-2"); gap.add("voice-stall-5");
    expect(voiceProblems(course!, gap)).toContain("voice: stall variants must be contiguous from 1");
  });
  it("rejects orphan explanation ids, oversized thoughts, and undeclared Fluent variables", () => {
    const ids = new Set(messageIds(course!.learnerFtl, "learner"));
    expect(voiceProblems(course!, ids, new Set(["street-again.missing-why"]))).toContain('voice: explanation "street-again.missing-why" has no exchange');
    const long = { ...course!, learnerFtl: course!.learnerFtl.replace(/^voice-stall-1 = .*$/m, `voice-stall-1 = ${"x".repeat(141)}`) };
    expect(voiceProblems(long, ids)).toContain("voice: voice-stall-1 exceeds 140 characters");
    const maxVars = { ...course!, learnerFtl: course!.learnerFtl.replace(/^voice-stall-1 = .*$/m, `voice-stall-1 = ${"x".repeat(135)}{ $wallet }`) };
    expect(voiceProblems(maxVars, ids)).toContain("voice: voice-stall-1 exceeds 140 characters");
    const punct = { ...course!, learnerFtl: course!.learnerFtl.replace(/^voice-stall-1 = .*$/m, "voice-stall-1 = why?.") };
    expect(voiceProblems(punct, ids)).toContain("voice: voice-stall-1 joins gloss punctuation incorrectly");
    const unknown = { ...course!, learnerFtl: course!.learnerFtl.replace(/^voice-stall-1 = .*$/m, "voice-stall-1 = { $unknown }") };
    expect(voiceProblems(unknown, ids).some((e) => e.includes("unknown"))).toBe(true);
  });
});
