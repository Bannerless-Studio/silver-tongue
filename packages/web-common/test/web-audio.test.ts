import { describe, expect, it } from "vitest";
import { createWebAudio, type AudioLike } from "../src/web-audio";

type FakeEl = AudioLike & { _src: string; played: { src: string; rate: number; defaultPlaybackRate: number }[]; paused: number; reject: boolean };

function fakeEl(): FakeEl {
  return {
    _src: "",
    playbackRate: 1,
    defaultPlaybackRate: 1,
    onended: null,
    onerror: null,
    played: [],
    paused: 0,
    reject: false,
    get src() {
      return this._src;
    },
    set src(v: string) {
      this._src = v;
      this.playbackRate = this.defaultPlaybackRate; // a new src resets the rate, as in a browser
    },
    play() {
      this.played.push({ src: this.src, rate: this.playbackRate, defaultPlaybackRate: this.defaultPlaybackRate });
      return this.reject ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve();
    },
    pause() {
      this.paused++;
    },
  };
}

function timers() {
  const waits: { ms: number; cb: () => void; cancelled: boolean }[] = [];
  const wait = (ms: number, cb: () => void) => {
    const w = { ms, cb, cancelled: false };
    waits.push(w);
    return { cancel: () => void (w.cancelled = true) };
  };
  // Every clip arms a backstop beside the 300 ms gap it leaves for the next one.
  return { waits, wait, beat: () => waits.filter((w) => w.ms === 300), backstop: () => waits.filter((w) => w.ms > 300) };
}

describe("createWebAudio", () => {
  it("plays clips in order with a 300 ms beat, slow lines 0.75 slower", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait }).play([{ clips: ["x"] }, { clips: ["y"], slow: true }, { clips: ["z"] }]);
    el.onended!();
    expect(beat()[0].ms).toBe(300);
    beat()[0].cb();
    el.onended!();
    beat()[1].cb();
    // Both rate fields, because a browser resets playbackRate to defaultPlaybackRate on a new src.
    expect(el.played).toEqual([
      { src: "audio/x.mp3", rate: 1, defaultPlaybackRate: 1 },
      { src: "audio/y.mp3", rate: 0.75, defaultPlaybackRate: 0.75 },
      { src: "audio/z.mp3", rate: 1, defaultPlaybackRate: 1 },
    ]);
  });

  it("plays at the speed the player chose, and a slow line 0.75 slower", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait, rate: () => 0.7 }).play([{ clips: ["x"] }, { clips: ["y"], slow: true }]);
    el.onended!();
    expect(el.played).toMatchObject([{ src: "audio/x.mp3", rate: 0.7 }]);
    beat()[0].cb();
    expect(el.played[1].rate).toBeCloseTo(0.525);
  });

  it("asks for the rate again for every clip, so a change takes at once", () => {
    const el = fakeEl();
    let rate = 0.7;
    const { beat, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait, rate: () => rate }).play([{ clips: ["x", "y"] }]);
    el.onended!();
    rate = 1;
    beat()[0].cb();
    expect(el.played.map((p) => p.rate)).toEqual([0.7, 1]);
  });

  it("never plays a clip slower than the floor, even if a page asks for it", () => {
    const el = fakeEl();
    const { wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait, rate: () => 0.2 }).play([{ clips: ["x"], slow: true }]);
    expect(el.played).toEqual([{ src: "audio/x.mp3", rate: 0.5, defaultPlaybackRate: 0.5 }]);
  });

  it("is busy from play() until the last clip ends, never with no audio element", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    expect(a.busy).toBe(false);
    a.play([{ clips: ["x", "y"] }]);
    expect(a.busy).toBe(true);
    el.onended!();
    expect(a.busy).toBe(true); // the second clip is queued
    beat()[0].cb();
    el.onended!();
    expect(a.busy).toBe(false);
    a.play([{ clips: ["x"] }]);
    a.stop();
    expect(a.busy).toBe(false);
    a.play([]); // nothing was said, so there is nothing to wait for
    expect(a.busy).toBe(false);
    const silent = createWebAudio({ base: "audio/", audio: undefined, wait: timers().wait });
    silent.play([{ clips: ["x"] }]);
    expect(silent.busy).toBe(false);
  });

  it("skips a clip that fails to load and goes on, and is not busy once the last one fails too", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y"] }]);
    el.onerror!();
    beat()[0].cb();
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
    el.onerror!(); // the last one fails as well, so there is nothing left to say
    expect(a.busy).toBe(false);
  });

  it("ignores a play() the browser refuses, stays available, and goes on to the next clip", async () => {
    const el = fakeEl();
    el.reject = true;
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    expect(() => a.play([{ clips: ["x", "y"] }])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(a.available).toBe(true);
    beat()[0].cb();
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
  });

  it("says no audio after three clips in a row fail to load (the page without its audio folder)", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y", "z", "w"] }]);
    el.onerror!();
    beat()[0].cb();
    el.onended!(); // one clip loads: the count starts again
    beat()[1].cb();
    el.onerror!();
    beat()[2].cb();
    el.onerror!();
    expect(a.available).toBe(true);
    a.play([{ clips: ["v"] }]);
    el.onerror!();
    expect(a.available).toBe(false);
  });

  it("stop pauses and drops the rest, even an ended event that comes late", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y"] }]);
    a.stop();
    el.onended?.();
    expect(el.paused).toBeGreaterThan(0);
    expect(beat()).toHaveLength(0);
    expect(el.played).toHaveLength(1);
  });

  it("stops dead in the beat between clips: the next clip never starts", () => {
    const el = fakeEl();
    const { beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y"] }]);
    el.onended!();
    a.stop();
    expect(a.busy).toBe(false);
    expect(beat()[0].cancelled).toBe(true);
    beat()[0].cb(); // a timer that fires anyway does nothing
    el.onended?.();
    expect(el.played).toHaveLength(1);
  });

  it("is unavailable with no audio element", () => {
    const a = createWebAudio({ base: "audio/", audio: undefined, wait: timers().wait });
    expect(a.available).toBe(false);
    expect(() => a.play([{ clips: ["x"] }])).not.toThrow();
  });

  it("ends a clip that reports no end at all once the backstop runs, and stays available", () => {
    const el = fakeEl();
    const { backstop, beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y"] }]);
    expect(a.busy).toBe(true);
    const first = backstop()[0];
    expect(first.ms).toBeGreaterThan(15_000); // four times the longest clip in a course
    first.cb(); // the load stalled: no onended, no onerror, nothing at all
    expect(a.busy).toBe(true); // so the next clip still gets its turn
    beat()[0].cb();
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
    backstop()[1].cb(); // the second one stalls as well
    expect(a.busy).toBe(false);
    expect(a.available).toBe(true); // a stall is not a missing audio folder
  });

  it("finishes a clip once, even when a stalled load reports an end afterwards", () => {
    const el = fakeEl();
    const { backstop, beat, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y", "z"] }]);
    backstop()[0].cb(); // x's load stalls, and the backstop lets it go
    el.onerror!(); // and only then does the load give up
    beat().forEach((b) => b.cb()); // however many beats are pending, only one clip may start
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
    expect(beat()).toHaveLength(1);
    backstop()[1].cb(); // y stalls too, so the line still comes to an end
    beat()[0].cb();
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3", "audio/z.mp3"]);
  });

  it("takes the backstop away as soon as a clip ends, so a healthy clip is never cut short", () => {
    const el = fakeEl();
    const { backstop, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x"] }]);
    expect(backstop()[0].cancelled).toBe(false);
    el.onended!();
    expect(backstop()[0].cancelled).toBe(true);
    backstop()[0].cb(); // a cancelled timer that fires anyway does nothing
    expect(a.busy).toBe(false);
    expect(el.played).toHaveLength(1);
  });

  it("takes the backstop away when a new play() starts, so a stale one cannot end the next clip's wait", () => {
    const el = fakeEl();
    const { backstop, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x"] }]);
    a.play([{ clips: ["y"] }]);
    expect(backstop()[0].cancelled).toBe(true);
    backstop()[0].cb(); // the first clip's backstop firing late must not finish the second
    expect(a.busy).toBe(true);
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
  });

  it("takes the backstop away on stop, so a stopped scene is left alone", () => {
    const el = fakeEl();
    const { backstop, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x"] }]);
    a.stop();
    expect(backstop()[0].cancelled).toBe(true);
    backstop()[0].cb();
    expect(a.busy).toBe(false);
    expect(el.played).toHaveLength(1);
  });
});
