// After the game's JS runs (src/boot.ts, src/ui/loading.ts): the startup watch over pending steps
// (fake timers), the JSON fetch that can't hang, the retry loop, and the loading screen's slow line,
// failure, Retry / Reload and the connection coming back (fake DOM).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_LOCALES } from "../locale";
import { JsonFetcher, LateLoad, ModuleLoadError, rerunnable, retrying, StallError, StartWatch, WebGLError } from "../src/boot";
import { LAYOUT, LayoutIndex } from "../src/layout";
import { AssetCache } from "../src/world";
import { ASSETS, assetIndex, readGlb } from "./helpers";
import { emptyLoad, loadSummary, reduceLoad } from "../src/loading";
import type { RetryAction } from "../src/preload.js";
import { LoadingScreen } from "../src/ui/loading";
import { FakeElement, installFakeDom } from "./fake-dom";

const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("the startup watch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const log: string[] = [];
    const w = new StartWatch({ slowMs: 15_000, failMs: 60_000, onSlow: (on) => log.push(on ? "slow" : "ok"), onStall: () => log.push("abort") });
    return { w, log };
  };
  const never = () => new Promise<never>(() => {});

  it("idle (nothing pending): never slow, never a stall", () => {
    const { w, log } = make();
    w.poke();
    vi.advanceTimersByTime(600_000);
    expect(log).toEqual([]);
  });

  it("a pending step with no progress: slow at 15 s, at 60 s rejected with a StallError and what's in flight aborted", async () => {
    const { w, log } = make();
    const p = w.track(never());
    const got = p.catch((e: unknown) => e);
    vi.advanceTimersByTime(15_000);
    expect(log).toEqual(["slow"]);
    vi.advanceTimersByTime(45_000);
    const e = await got;
    expect(e).toBeInstanceOf(StallError);
    expect(log).toEqual(["slow", "ok", "abort"]);
    expect(w.busy).toBe(0);
    // the step tried again: the watch runs again
    const again = w.track(never()).catch((x: unknown) => x);
    vi.advanceTimersByTime(60_000);
    expect(await again).toBeInstanceOf(StallError);
  });

  it("progress keeps it quiet; a step settling is progress; the last one done stops it", async () => {
    const { w, log } = make();
    let done!: (v: number) => void;
    const a = w.track(new Promise<number>((r) => (done = r)));
    const b = w.track(never()).catch(() => "stalled");
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(10_000);
      w.poke();
    }
    expect(log).toEqual([]);
    vi.advanceTimersByTime(14_000);
    done(7);
    expect(await a).toBe(7);
    vi.advanceTimersByTime(14_000);
    expect(log).toEqual([]); // counted again from a's end
    vi.advanceTimersByTime(46_000);
    expect(await b).toBe("stalled");
    expect(w.busy).toBe(0);
    vi.advanceTimersByTime(600_000);
    expect(log).toEqual(["slow", "ok", "abort"]);
  });

  it("a step's own failure passes through", async () => {
    const { w } = make();
    await expect(w.track(Promise.reject(new Error("404")))).rejects.toThrow("404");
    expect(w.busy).toBe(0);
  });
});

/** A fetch whose bodies stream what the test pushes; aborting rejects the pending read, as a browser does. */
function fakeFetch() {
  const calls: { url: string; push: (s: string) => void; end: () => void }[] = [];
  const fetch = (url: string, init?: RequestInit) => {
    const enc = new TextEncoder();
    const waiting: ((r: ReadableStreamReadResult<Uint8Array>) => void)[] = [];
    const failing: ((e: unknown) => void)[] = [];
    const ready: ReadableStreamReadResult<Uint8Array>[] = [];
    const give = (r: ReadableStreamReadResult<Uint8Array>) => {
      const w = waiting.shift();
      failing.shift();
      if (w) w(r);
      else ready.push(r);
    };
    calls.push({ url, push: (s) => give({ done: false, value: enc.encode(s) }), end: () => give({ done: true, value: undefined }) });
    init?.signal?.addEventListener("abort", () => failing.splice(0).forEach((f) => f(new DOMException("aborted", "AbortError"))));
    const status = url.includes("missing") ? 404 : 200;
    return Promise.resolve({
      ok: status === 200,
      status,
      body: {
        getReader: () => ({
          read: () =>
            new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
              if (init?.signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
              if (ready.length) return resolve(ready.shift()!);
              waiting.push(resolve);
              failing.push(reject);
            }),
        }),
      },
    } as unknown as Response);
  };
  return { fetch, calls };
}

describe("the JSON fetch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads the body in chunks (each one progress) into JSON; a 404 throws", async () => {
    const f = fakeFetch();
    let bytes = 0;
    const j = new JsonFetcher({ fetch: f.fetch, stallMs: 60_000, onBytes: () => bytes++ });
    const p = j.get<{ a: number }>("x.json");
    await tick();
    f.calls[0].push('{"a"');
    f.calls[0].push(":1}");
    f.calls[0].end();
    expect(await p).toEqual({ a: 1 });
    expect(bytes).toBe(2);
    await expect(j.get("missing.json")).rejects.toThrow("missing.json: 404");
  });

  it("no chunk for stallMs: aborted, a StallError; abortAll() stops every one in flight the same way", async () => {
    const f = fakeFetch();
    const j = new JsonFetcher({ fetch: f.fetch, stallMs: 60_000 });
    const p = j.get("slow.json").catch((e: unknown) => e);
    await tick();
    f.calls[0].push('{"a":');
    vi.advanceTimersByTime(59_000);
    f.calls[0].push("1");
    vi.advanceTimersByTime(59_000); // still alive: bytes came 59 s ago
    await tick();
    vi.advanceTimersByTime(1_000);
    const e = await p;
    expect(e).toBeInstanceOf(StallError);
    expect((e as Error).message).toBe("slow.json: no data for 60 s");
    const q = j.get("other.json").catch((x: unknown) => x);
    await tick();
    j.abortAll();
    expect(await q).toBeInstanceOf(StallError);
  });
});

describe("the retry loop", () => {
  it("each failure waits on its button, then the step runs again; Reload after `retries`; no WebGL or a failed module: Reload at once", async () => {
    const asked: RetryAction[] = [];
    let n = 0;
    const v = await retrying(
      async () => {
        if (++n < 3) throw new Error("offline");
        return "town";
      },
      async (_e, a) => void asked.push(a),
    );
    expect(v).toBe("town");
    expect(asked).toEqual(["retry", "retry"]);
    asked.length = 0;
    n = 0;
    await retrying(
      async () => {
        if (++n < 5) throw new Error("offline");
        return 1;
      },
      async (_e, a) => void asked.push(a),
    );
    expect(asked).toEqual(["retry", "retry", "reload", "reload"]);
    expect(rerunnable(new WebGLError("x"))).toBe(false);
    expect(rerunnable(new ModuleLoadError("x"))).toBe(false);
    expect(rerunnable(new StallError("x"))).toBe(true);
    asked.length = 0;
    let first = true;
    await retrying(
      async () => {
        if (first) {
          first = false;
          throw new WebGLError("no context");
        }
      },
      async (_e, a) => void asked.push(a),
    );
    expect(asked).toEqual(["reload"]);
  });
});

describe("the loading screen after boot", () => {
  const make = () => {
    installFakeDom();
    const root = new FakeElement("div");
    let reloads = 0;
    const screen = new LoadingScreen(root as unknown as HTMLElement, "Silver Tongue", UI_LOCALES.en.loading, () => void reloads++);
    const $ = (c: string) => root.querySelector(`.ld-${c}`)!;
    return { screen, root, $, reloads: () => reloads };
  };

  it("takes the preloader's card over: the slow line on and off", () => {
    const { screen, $ } = make();
    expect($("slow").hidden).toBe(true);
    screen.slow(true);
    expect($("slow").hidden).toBe(false);
    expect($("slow").textContent).toBe(UI_LOCALES.en.loading.slow);
    screen.slow(false);
    expect($("slow").hidden).toBe(true);
  });

  it("a failure: the message, the error small, Retry resolves every step waiting; with a reload among them, the button reloads", async () => {
    const { screen, root, $, reloads } = make();
    const release = screen.hold();
    let a = false;
    let b = false;
    void screen.fail("Couldn't load", "index.json: 503", "retry").then(() => (a = true));
    void screen.fail("Couldn't load", "catalog: offline", "retry").then(() => (b = true));
    expect(root.classList.contains("error")).toBe(true);
    expect($("item").textContent).toBe("Couldn't load");
    expect($("err").textContent).toBe("catalog: offline");
    expect($("retry").textContent).toBe("Retry");
    $("retry").click();
    await tick();
    expect([a, b]).toEqual([true, true]);
    expect(root.classList.contains("error")).toBe(false);
    expect(root.hidden).toBe(false); // the start's hold is still on
    void screen.fail("x", "y", "retry");
    void screen.fail("no WebGL", "z", "reload");
    expect($("retry").textContent).toBe("Reload");
    $("retry").click();
    expect(reloads()).toBe(1);
    release();
    expect(root.hidden).toBe(false); // a failure stays until its button
  });

  it("a progress tick that lands after a failure (a room's assets streaming in behind an unrelated failed fetch) doesn't blank the message", () => {
    const { screen, $ } = make();
    void screen.fail("Couldn't load the game. Check your connection.", "Failed to fetch", "retry");
    expect($("item").textContent).toBe("Couldn't load the game. Check your connection.");
    let s = reduceLoad(emptyLoad, { type: "start", name: "a.glb", bytes: 100 });
    s = reduceLoad(s, { type: "progress", name: "a.glb", loaded: 40 });
    screen.render(loadSummary(s));
    expect($("item").textContent).toBe("Couldn't load the game. Check your connection.");
    expect($("err").textContent).toBe("Failed to fetch");
  });

  it("the connection back presses Retry once per failure", async () => {
    const { screen } = make();
    let n = 0;
    void screen.fail("x", "", "retry").then(() => n++);
    screen.online();
    screen.online();
    await tick();
    expect(n).toBe(1);
    expect(screen.failed).toBe(false);
    void screen.fail("x", "", "retry").then(() => n++);
    screen.online();
    await tick();
    expect(n).toBe(2);
  });
});

describe("the bar across a retry", () => {
  it("a file that failed and is asked for again counts from 0 again, not as done", () => {
    let s = reduceLoad(emptyLoad, { type: "start", name: "a", bytes: 100 });
    s = reduceLoad(s, { type: "progress", name: "a", loaded: 40 });
    s = reduceLoad(s, { type: "fail", name: "a" });
    expect(loadSummary(s).complete).toBe(true);
    s = reduceLoad(s, { type: "start", name: "a", bytes: 100 });
    expect(s.items[0]).toEqual({ name: "a", total: 100, loaded: 0, done: false });
    expect(loadSummary(s).complete).toBe(false);
    s = reduceLoad(s, { type: "done", name: "a" });
    expect(loadSummary(s).fraction).toBe(1);
  });
});

describe.skipIf(!assetIndex)("a stalled GLB where abort can't reach the fetch (no AbortSignal.any)", () => {
  it("abort() forgets every template not loaded: the next ask fetches it again, a loaded one stays", async () => {
    const L = new LayoutIndex(LAYOUT, assetIndex!);
    const [a, b] = L.assetNames();
    let reads = 0;
    let hang = true;
    // a loader whose reads hang, as a fetch the manager's abort never reaches
    const assets = new AssetCache(ASSETS, L, {
      read: (url) => {
        reads++;
        return hang && !url.endsWith(L.asset(a).path) ? new Promise<ArrayBuffer>(() => {}) : readGlb(url);
      },
    });
    await assets.template(a);
    void assets.template(b);
    await tick();
    expect(reads).toBe(2);
    assets.abort();
    expect(assets.has(a)).toBe(true);
    expect(assets.has(b)).toBe(false);
    hang = false;
    await assets.template(b); // asked again: read again, and it lands
    expect(reads).toBe(3);
    expect(assets.loaded.has(b)).toBe(true);
  });
});

describe("something loaded late (the sound manifest)", () => {
  it("tried at once, again at each kick after a failure until it is in, then never again; its user gets it once", async () => {
    let tries = 0;
    let ok = false;
    const late = new LateLoad(async () => {
      tries++;
      if (!ok) throw new StallError("stalled");
      return ["m"];
    });
    const got: string[][] = [];
    late.use((v) => got.push(v));
    late.kick();
    await tick();
    expect([tries, late.loaded]).toEqual([1, false]);
    ok = true;
    late.kick(); // the connection back, a gesture
    late.kick(); // one try at a time
    await tick();
    expect([tries, late.loaded]).toEqual([2, true]);
    late.kick();
    await tick();
    expect(tries).toBe(2);
    late.use((v) => got.push(v));
    expect(got).toEqual([["m"], ["m"]]);
  });
});
