import { describe, expect, it } from "vitest";
import { createWebAudio, type AudioLike } from "../src/web-audio";

type FakeEl = AudioLike & { played: { src: string; rate: number }[]; paused: number; reject: boolean };

function fakeEl(): FakeEl {
  return {
    src: "",
    playbackRate: 1,
    defaultPlaybackRate: 1,
    onended: null,
    onerror: null,
    played: [],
    paused: 0,
    reject: false,
    play() {
      expect(this.defaultPlaybackRate).toBe(this.playbackRate);
      this.played.push({ src: this.src, rate: this.playbackRate });
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
  return { waits, wait };
}

describe("createWebAudio", () => {
  it("plays clips in order with a 300 ms beat, slow lines at 0.8", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait }).play([{ clips: ["x"] }, { clips: ["y"], slow: true }, { clips: ["z"] }]);
    el.onended!();
    expect(waits[0].ms).toBe(300);
    waits[0].cb();
    el.onended!();
    waits[1].cb();
    expect(el.played).toEqual([
      { src: "audio/x.mp3", rate: 1 },
      { src: "audio/y.mp3", rate: 0.8 },
      { src: "audio/z.mp3", rate: 1 },
    ]);
  });

  it("skips a clip that fails to load and goes on", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    createWebAudio({ base: "audio/", audio: el, wait }).play([{ clips: ["x", "y"] }]);
    el.onerror!();
    waits[0].cb();
    expect(el.played.map((p) => p.src)).toEqual(["audio/x.mp3", "audio/y.mp3"]);
  });

  it("ignores a play() the browser refuses, and stays available", async () => {
    const el = fakeEl();
    el.reject = true;
    const a = createWebAudio({ base: "audio/", audio: el, wait: timers().wait });
    expect(() => a.play([{ clips: ["x"] }])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(a.available).toBe(true);
  });

  it("stop pauses and drops the rest, even an ended event that comes late", () => {
    const el = fakeEl();
    const { waits, wait } = timers();
    const a = createWebAudio({ base: "audio/", audio: el, wait });
    a.play([{ clips: ["x", "y"] }]);
    a.stop();
    el.onended?.();
    expect(el.paused).toBeGreaterThan(0);
    expect(waits).toHaveLength(0);
    expect(el.played).toHaveLength(1);
  });

  it("is unavailable with no audio element", () => {
    const a = createWebAudio({ base: "audio/", audio: undefined, wait: timers().wait });
    expect(a.available).toBe(false);
    expect(() => a.play([{ clips: ["x"] }])).not.toThrow();
  });
});
