import { describe, expect, it } from "vitest";
import { comboKey, createCore, mulberry32, newGame } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import type { CourseExtra } from "@silver-tongue/view";
import { createQuiet } from "../src/quiet";
import { replyOrder, stageView } from "../src/stage";

function setup() {
  const course = fixtureWithText();
  (course as unknown as CourseExtra).language.book = true;
  const core = createCore(course, newGame(course), { now: () => 1_000_000, rng: mulberry32(1) });
  let clock = 1_000_000;
  const q = createQuiet({ course, core, now: () => (clock += 1000) });
  const stage = () => stageView(q.view().backlog, q.view().stageFrom);
  const right = () => core.state.run!.options.indexOf(comboKey(core.state.run!.combo));
  const wrong = (skip: number[] = []) => core.state.run!.options.findIndex((_, i) => i !== right() && !skip.includes(i));
  /** walks the bright controls into the first scene */
  const enter = () => {
    for (let n = 0; n < 5 && !core.state.run; n++) {
      const p = q.view().phase as { primary?: number };
      q.choose(p.primary ?? 0);
    }
  };
  return { q, core, stage, right, wrong, enter };
}

describe("the conversation stage", () => {
  it("between scenes holds only the latest stage directions; a scene's opening waits for its first line", () => {
    const { stage, enter } = setup();
    const before = stage();
    expect(before.exchanges).toEqual([]);
    expect(before.direction.length).toBeGreaterThan(0);
    enter();
    const s = stage();
    expect(s.exchanges).toHaveLength(1);
    expect(s.exchanges[0].direction.map((b) => b.tone)).toEqual(expect.arrayContaining(["narr"]));
    expect(s.direction).toEqual([]);
  });

  it("misses never stack: the request stays one exchange, said again, with the replies tried kept aside", () => {
    const { q, stage, right, wrong, enter } = setup();
    enter();
    const first = stage().exchanges[0];
    const w1 = wrong();
    q.choose(w1);
    let x = stage().exchanges;
    expect(x).toHaveLength(1);
    expect(x[0].line.id).toBe(first.line.id);
    expect(x[0].again).toBe(1);
    expect(x[0].reaction).toBeDefined();
    expect(x[0].missed.map((m) => m.line?.text)).toEqual([x[0].said!.line!.text]);
    const w2 = wrong([w1]);
    expect(w2).toBeGreaterThanOrEqual(0);
    q.choose(w2);
    x = stage().exchanges;
    expect(x).toHaveLength(1);
    expect(x[0].again).toBe(2);
    expect(x[0].missed).toHaveLength(2);
    expect(stage().history.filter((r) => r.ex !== undefined)).toEqual([]);
    // Tried replies go last, in the order the number keys follow.
    const options = (q.view().phase as { options: { text: string }[] }).options;
    const order = replyOrder(options as never, x[0].missed);
    expect(order.slice(-x[0].missed.length).map((i) => options[i].text).sort()).toEqual(x[0].missed.map((m) => m.line!.text).sort());
    // The right reply moves the pair to history once: the request and the reply that answered it, no misses.
    q.choose(right());
    const s = stage();
    expect(s.exchanges.length).toBeGreaterThan(1);
    const said = s.history.filter((r) => r.ex === 0 && r.beat.speaker);
    expect(said.map((r) => r.beat.speaker === "player")).toEqual([false, true]);
    expect(said[1].beat.line!.text).not.toBe(x[0].missed[0].line!.text);
  });
});
