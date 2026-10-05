import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { comboKey, createCore, mulberry32, newGame, personalize, tilePieces, type Course, type Core } from "@silver-tongue/core";
import { makeText, paperSyllables, deskPapers, romanize, pickVoice, voiceHint, voiceDesk, deskVoiceRule, voiceEvents } from "@silver-tongue/view";
import { buildCourse } from "../../../tools/src/build-course";
import { startApp, type AppPresentation } from "../src/app";
import { plain } from "../src/terminal";
import { FakeTerminal } from "./fake-terminal";

const CONTENT = fileURLToPath(new URL("../../../content", import.meta.url));
function setup(id = "ko-seoul") {
  const { course, errors } = buildCourse(CONTENT, id);
  expect(errors).toEqual([]);
  const core = createCore(course!, newGame(course!), { now: () => 1000, rng: mulberry32(1) });
  const term = new FakeTerminal(140, 60);
  let presentation: AppPresentation | undefined;
  let picks = 0;
  const daily = new Map<number, string[]>();
  const expected = new Map<string, string>();
  const originalSend = core.send.bind(core);
  vi.spyOn(core, "send").mockImplementation((input) => {
    const before = structuredClone(core.state);
    let memory = presentation?.voice;
    const events = originalSend(input);
    if (memory) for (const cue of voiceEvents(course!, before, core.state, events, makeText(course!.learnerFtl, "en"), 1000)) {
      const picked = pickVoice(memory, cue, makeText(course!.learnerFtl, "en"));
      memory = picked.memory;
      if (picked.line) expected.set(cue.trigger, picked.line);
    }
    return events;
  });
  startApp({ course: course!, core, term, now: () => 1000, quit: () => {}, presentation: { load: () => presentation, save: (v) => { presentation = structuredClone(v);
    if (v.voice.picks > picks) { daily.set(v.voice.day, [...(daily.get(v.voice.day) ?? []), v.voice.used.at(-1)!]); picks = v.voice.picks; }
    return true; } }, settings: { courses: [], switchTo: () => {} } });
  const screen = () => term.screen().join("\n");
  return { course: course!, core, term, screen, daily, expected, presentation: () => presentation };
}
function answer(course: Course, core: Core, term: FakeTerminal) {
  const run = core.state.run!;
  const v = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].variants[comboKey(run.combo)];
  if (run.mode === "pick") term.press(String(run.options.indexOf(comboKey(run.combo)) + 1));
  else if (run.mode === "type") { term.type(personalize(v.reply, core.state.player ?? "Sam").text); term.press("return"); }
  else {
    const used = new Set<number>();
    for (const piece of tilePieces(v.reply)) { const i = run.tiles.findIndex((t, i) => t === piece && !used.has(i)); used.add(i); term.press(String(i + 1)); }
    term.press("return");
  }
}

describe("Korean terminal experiment", () => {
  it("plays the opening, three papers, Book, first three scenes, night and morning through terminal keys", () => {
    const app = setup();
    const { course, core, term, screen } = app;
    const t = makeText(course.learnerFtl, "en");
    expect(screen()).toContain("You fell asleep");
    expect(screen()).not.toContain("[b] book");
    for (let i = 1; t.has(`intro-${i}`); i++) term.press("return");
    expect(screen()).toContain(t("name-prompt"));
    term.type("Sam"); term.press("return");
    expect(screen()).toContain(t("quiet-desk-why"));
    const papers = deskPapers(course);
    expect(papers).toHaveLength(3);
    for (const [p, paper] of papers.entries()) {
      const syls = paperSyllables(paper);
      if (p === 0) {
        const used = app.presentation()!.voice.used.length;
        term.type("zzz"); term.press("return");
        expect(app.presentation()!.voice.used).toHaveLength(used);
        const wrong = pickVoice(app.presentation()!.voice, voiceDesk(course, core.state, t, 1000, "desk-wrong", t(`voice-rule-${deskVoiceRule(course, syls[0].ch)}`)), t).line!;
        term.type("zzz"); term.press("return");
        expect(app.presentation()!.voice.used).toHaveLength(used + 1);
        expect(screen()).toContain(`› ${wrong}`);
        term.press("?", "tab");
        expect(screen()).toContain(t("book-title"));
        term.press("escape");
      }
      for (const [index, syllable] of syls.entries()) {
        const done = index === syls.length - 1 ? pickVoice(app.presentation()!.voice, voiceDesk(course, core.state, t, 1000, "paper-done", t(`voice-paper-${paper.id}`)), t).line : undefined;
        term.type(romanize(syllable.ch)); term.press("return");
        if (done) expect(screen()).toContain(`› ${done}`);
      }
      expect(app.presentation()!.read).toContain(paper.id);
      expect(screen()).toContain("› ");
      term.press("return");
    }
    expect(core.state.run?.scene).toBe("room-wake");
    term.press("b");
    expect(screen()).toContain(t("book-title"));
    term.press("1"); expect(screen()).toContain("ㅈ");
    term.press("escape");
    const stall = pickVoice(app.presentation()!.voice, voiceHint(course, core.state, t, 1000, "stall")!, t).line!;
    term.press("h"); expect(screen()).toContain(`› ${stall}`);
    answer(course, core, term); // the opening call has only a correct reply
    answer(course, core, term); // the friend's alternative is an accepted lie
    // Wrong replies advance misses one at a time; "..." asks core to repeat immediately.
    expect(core.state.run!.mode).toBe("pick");
    const wrongReply = () => term.press(String(core.state.run!.options.findIndex((key) => key !== comboKey(core.state.run!.combo)) + 1));
    for (const [index, trigger] of (["first-miss", "second-miss"] as const).entries()) {
      const thought = pickVoice(app.presentation()!.voice, voiceHint(course, core.state, t, 1000, trigger)!, t).line!;
      wrongReply(); expect(core.state.run!.misses).toBe(index + 1);
      expect(screen()).toContain(`› ${thought}`);
    }
    for (const id of ["room-wake", "street-hello", "street-again"]) {
      for (let i = 0; !core.state.run && i < 10; i++) term.press("return");
      expect(core.state.run?.scene).toBe(id);
      for (let i = 0; core.state.run && i < 30; i++) answer(course, core, term);
      expect(core.state.scenesDone[id]).toBe(1);
      expect(screen()).toContain(`› ${app.expected.get("scene-end")}`);
    }
    term.press("s"); expect(screen()).toContain(t("quiet-status")); term.press("escape", "o");
    expect(screen()).toContain(t("settings-title")); term.press("escape");
    // Continue by the bright control until the day is used, then follow it back to bed.
    for (let i = 0; i < 150 && core.state.day === 1; i++) {
      if (core.state.run) answer(course, core, term); else term.press("return");
    }
    expect(core.state.day).toBe(2);
    expect(screen()).toContain(`› ${app.expected.get("day-start")}`);
    expect(term.frames.flat().map(plain)).toContainEqual(expect.stringContaining(`› ${app.expected.get("night")}`));
    expect(app.presentation()!.voice.once).toContain("night:1");
    expect(app.presentation()!.voice.once).toContain("day-start:2");
    for (const day of [1, 2]) { const lines = app.daily.get(day)!; expect(lines.length).toBeGreaterThan(0); expect(new Set(lines).size).toBe(lines.length); }
    const transcript = term.frames.map((f) => f.map(plain).filter((l) => l.includes("› ")).join("\n")).filter(Boolean);
    expect(transcript.length).toBeGreaterThan(8);
  });

  it("keeps Tab as hint and lets h think only while type input is empty", () => {
    const { course, errors } = buildCourse(CONTENT, "ko-seoul");
    expect(errors).toEqual([]);
    const state = newGame(course!); state.player = "Sam";
    const core = createCore(course!, state, { now: () => 1000, rng: mulberry32(1) });
    core.send({ type: "startScene", scene: "room-wake" });
    expect(core.state.run).toBeTruthy();
    core.state.run!.mode = "type"; // Resume fixture: the same exchange in core's text-entry mode.
    const term = new FakeTerminal(140, 60);
    let stored: AppPresentation = { read: deskPapers(course!).map((p) => p.id), desk: { at: {}, met: [] }, voice: { day: 1, seed: 42, used: [], once: ["day-start:1"], picks: 0 } };
    const t = makeText(course!.learnerFtl, "en");
    const send = vi.spyOn(core, "send");
    startApp({ course: course!, core, term, now: () => 1000, quit: () => {}, presentation: { load: () => stored, save: (v) => { stored = structuredClone(v); return true; } } });
    send.mockClear();
    const thought = pickVoice(stored.voice, voiceHint(course!, core.state, t, 1000, "stall")!, t).line!;
    term.press("h");
    expect(term.screen().join("\n")).toContain(`› ${thought}`);
    expect(send).not.toHaveBeenCalled();
    term.press("tab");
    expect(send).toHaveBeenLastCalledWith({ type: "hint" });
    expect(term.screen().at(-1)?.match(/\[tab\]/g)).toHaveLength(1);
    send.mockClear();
    term.type("x"); term.press("h");
    expect(term.screen().join("\n")).toContain("xh");
    expect(send).not.toHaveBeenCalled();
  });

  it("persists core progress when voice storage throws, and supports read-only presentation", () => {
    const { course } = setup();
    const state = newGame(course); state.player = "Sam";
    const core = createCore(course, state, { now: () => 1000, rng: mulberry32(1) });
    core.send({ type: "startScene", scene: "room-wake" });
    for (let i = 0; i < 2; i++) core.send({ type: "reply", choice: core.state.run!.options.indexOf(comboKey(core.state.run!.combo)) });
    const term = new FakeTerminal(140, 60);
    const stored: AppPresentation = { read: deskPapers(course).map((p) => p.id), desk: { at: {}, met: [] }, voice: { day: 1, seed: 42, used: [], once: ["day-start:1"], picks: 0 } };
    const save = vi.fn(() => true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      startApp({ course, core, term, now: () => 1000, quit: () => {}, save, presentation: { load: () => stored, save: (v) => {
        if (core.state.run!.misses > 0) throw new Error("voice storage failure");
        return true;
      } } });
      save.mockClear(); warn.mockClear();
      expect(() => term.press(String(core.state.run!.options.findIndex((key) => key !== comboKey(core.state.run!.combo)) + 1))).not.toThrow();
      expect(core.state.run!.misses).toBe(1);
      expect(save).toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      const readOnly = new FakeTerminal(140, 60);
      startApp({ course, core, term: readOnly, now: () => 1000, quit: () => {}, notice: "notice-read-only", presentation: { load: () => stored } });
      readOnly.press("h");
      const notice = makeText(course.learnerFtl, "en")("notice-read-only");
      expect(readOnly.screen().join("\n").split(notice)).toHaveLength(2);
    } finally { warn.mockRestore(); }
  });

  it("resumes a partially read desk from the per-session presentation store", () => {
    const { course } = setup();
    const state = newGame(course); state.player = "Sam";
    const core = createCore(course, state, { now: () => 1000, rng: mulberry32(1) });
    const p = deskPapers(course)[0];
    const term = new FakeTerminal(140, 50);
    const stored: AppPresentation = { read: [], desk: { at: { [p.id]: 2 }, met: [] }, voice: { day: 1, seed: 1, used: ["first-day-1"], once: ["day-start:1"], picks: 1 } };
    startApp({ course, core, term, now: () => 1000, quit: () => {}, presentation: { load: () => stored, save: () => true } });
    expect(term.screen().join("\n")).toContain(paperSyllables(p)[2].ch);
    term.press("tab"); expect(term.screen().join("\n")).toContain(makeText(course.learnerFtl, "en")("book-title"));
  });

  it("keeps zh-china frames identical with or without Korean presentation data", () => {
    const { course } = setup("zh-china");
    function frames(withStore: boolean) {
      const core = createCore(course, newGame(course), { now: () => 1000, rng: mulberry32(1) });
      const term = new FakeTerminal();
      startApp({ course, core, term, now: () => 1000, quit: () => {}, ...(withStore ? { presentation: { load: () => ({ read: [], voice: { day: 1, used: ["A thought"], once: [], seed: 1, picks: 1 } }), save: () => true } } : {}) });
      term.press("1", "1", "h", "?", "n", "escape");
      return term.frames;
    }
    expect(frames(true)).toEqual(frames(false));
    expect(frames(false).flat(2).some((span) => span.text.startsWith("› "))).toBe(false);
  });
});
