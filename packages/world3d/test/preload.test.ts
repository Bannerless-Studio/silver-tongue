// The page's preloader (src/preload.js, inlined into index.html by build.mjs): its byte accounting,
// the stall watchdog (fake timers), the retry state machine, the language it picks, and the runner
// on a fake page (fake DOM, fake fetch with streamed bodies): the bar, the module script, a 404, a
// stall, Retry then Reload, the connection coming back, errors before and after the game boots.
import { readFileSync } from "node:fs";
import { SETTINGS_KEY } from "@silver-tongue/web-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_UI, UI_LOCALES } from "../locale";
import { boot, mb, pickLocale, retryAction, tally, Watchdog, type PreloadConfig } from "../src/preload.js";
import { FakeElement, installFakeDom } from "./fake-dom";

describe("the preloader's byte accounting", () => {
  const files: [string, number][] = [
    ["./main.js", 300_000],
    ["./chunks/a.js", 600_000],
  ];

  it("by bytes against the sizes the build measured", () => {
    expect(tally(files, {}, {})).toEqual({ loaded: 0, total: 900_000, fraction: 0 });
    const t = tally(files, { "./main.js": 150_000, "./chunks/a.js": 300_000 }, {});
    expect(t.loaded).toBe(450_000);
    expect(t.fraction).toBeCloseTo(0.5);
    expect(mb(t.total)).toBe("0.9");
  });

  it("a stale page: a file bigger than the build said counts at its real size, a finished smaller one at what came; never past 100 %", () => {
    const big = tally(files, { "./main.js": 400_000 }, {});
    expect(big.total).toBe(1_000_000);
    expect(big.fraction).toBeLessThanOrEqual(1);
    const done = tally(files, { "./main.js": 200_000, "./chunks/a.js": 600_000 }, { "./main.js": true, "./chunks/a.js": true });
    expect(done).toEqual({ loaded: 800_000, total: 800_000, fraction: 1 });
    expect(tally([], {}, {}).fraction).toBe(1);
  });
});

describe("the stall watchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const log: string[] = [];
    const dog = new Watchdog({ slowMs: 15_000, failMs: 45_000, onSlow: (on) => log.push(on ? "slow" : "ok"), onFail: () => log.push("fail") });
    return { dog, log };
  };

  it("15 s without progress: slow; progress: not slow again, and the count starts over; 45 s: fail, once, and it stops", () => {
    const { dog, log } = make();
    dog.start();
    vi.advanceTimersByTime(14_999);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(["slow"]);
    expect(dog.slow).toBe(true);
    vi.advanceTimersByTime(20_000);
    dog.poke();
    expect(log).toEqual(["slow", "ok"]);
    vi.advanceTimersByTime(44_999);
    expect(log).toEqual(["slow", "ok", "slow"]);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(["slow", "ok", "slow", "ok", "fail"]);
    expect(dog.on).toBe(false);
    dog.poke(); // stopped: progress after the failure does nothing
    vi.advanceTimersByTime(100_000);
    expect(log).toHaveLength(5);
  });

  it("steady progress never trips it; stop() disarms it; nothing before start()", () => {
    const { dog, log } = make();
    dog.poke();
    vi.advanceTimersByTime(60_000);
    expect(log).toEqual([]);
    dog.start();
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(10_000);
      dog.poke();
    }
    expect(log).toEqual([]);
    dog.stop();
    vi.advanceTimersByTime(100_000);
    expect(log).toEqual([]);
  });
});

describe("the retry state machine", () => {
  it("Retry while the step can run again and at most `retries` failures came before; then Reload", () => {
    expect([1, 2, 3].map((n) => retryAction(n, true, 1))).toEqual(["retry", "reload", "reload"]);
    expect([1, 2, 3].map((n) => retryAction(n, true, 2))).toEqual(["retry", "retry", "reload"]);
    expect(retryAction(1, false, 5)).toBe("reload");
  });
});

describe("the loading screen's language", () => {
  const t = { en: 1, bn: 1, zh: 1 };
  it("?ui=, then the remembered reading language, then the browser's (region dropped), else the fallback", () => {
    expect(pickLocale(t, "?ui=zh", '{"learner":"bn"}', ["en-US"], "en")).toBe("zh");
    expect(pickLocale(t, "?ui=xx", '{"course":"zh-china","learner":"bn"}', ["en-US"], "en")).toBe("bn");
    expect(pickLocale(t, "", null, ["fr-FR", "bn-BD"], "en")).toBe("bn");
    expect(pickLocale(t, "", "junk", ["fr"], "en")).toBe("en");
    expect(pickLocale(t, "", null, [undefined as unknown as string], "en")).toBe("en");
  });
  it("every UI language has every loading string (the preloader gets them all)", () => {
    const keys = Object.keys(UI_LOCALES[FALLBACK_UI].loading).sort();
    for (const [l, loc] of Object.entries(UI_LOCALES)) {
      expect(Object.keys(loc.loading).sort(), l).toEqual(keys);
      for (const k of keys) expect(loc.loading[k as keyof typeof loc.loading], `${l} ${k}`).toBeTruthy();
    }
  });
  it("build.mjs reads the reading language from the settings key web-common writes", () => {
    const build = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
    expect(build).toContain(`key: "${SETTINGS_KEY}"`);
  });
});

// ---------------------------------------------------------------------------------------------
// The runner on a fake page
// ---------------------------------------------------------------------------------------------

/** A response whose body streams the chunks pushed into it; `end()` finishes it. */
function streamed(status = 200) {
  const queue: ((r: { done: boolean; value?: Uint8Array }) => void)[] = [];
  const ready: { done: boolean; value?: Uint8Array }[] = [];
  const give = (r: { done: boolean; value?: Uint8Array }) => {
    const w = queue.shift();
    if (w) w(r);
    else ready.push(r);
  };
  return {
    res: {
      ok: status === 200,
      status,
      body: { getReader: () => ({ read: () => new Promise<{ done: boolean; value?: Uint8Array }>((r) => (ready.length ? r(ready.shift()!) : queue.push(r))) }) },
    },
    push: (n: number) => give({ done: false, value: new Uint8Array(n) }),
    end: () => give({ done: true }),
  };
}

function page(opts: { protocol?: string; settings?: string; languages?: string[] } = {}) {
  const doc = installFakeDom();
  const root = new FakeElement("div");
  root.id = "loading";
  const q = (tag: string, cls: string) => {
    const n = new FakeElement(tag);
    n.className = cls;
    return n;
  };
  const card = q("div", "ld-card");
  const bar = q("div", "ld-bar");
  bar.append(q("div", "ld-fill"));
  const line = q("p", "ld-line");
  line.append(q("b", "ld-pct"), q("span", "ld-bytes"));
  card.append(bar, line, q("p", "ld-item"), q("p", "ld-slow"), q("button", "ld-retry"), q("p", "ld-err"));
  root.append(card);
  doc.body.append(root);
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const requests: { url: string; signal?: AbortSignal; resolve: (r: unknown) => void; reject: (e: unknown) => void }[] = [];
  let reloads = 0;
  const win = {
    navigator: { languages: opts.languages ?? ["en-US"], language: "en-US" },
    location: { search: "", protocol: opts.protocol ?? "https:", reload: () => void reloads++ },
    localStorage: { getItem: () => opts.settings ?? null },
    AbortController,
    __stBooted: false,
    addEventListener: (type: string, f: (e: unknown) => void) => listeners.set(type, [...(listeners.get(type) ?? []), f]),
    fetch: (url: string, init: { signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        requests.push({ url, signal: init.signal, resolve, reject });
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  };
  const emit = (type: string, e: unknown = {}) => (listeners.get(type) ?? []).forEach((f) => f(e));
  const $ = (c: string) => root.querySelector(`.ld-${c}`)!;
  const cfg: PreloadConfig = {
    files: [
      ["./main.js", 1000],
      ["./chunks/three.js", 3000],
    ],
    entry: "./main.js",
    s: Object.fromEntries(Object.entries(UI_LOCALES).map(([l, x]) => [l, x.loading])),
    fallback: FALLBACK_UI,
    key: SETTINGS_KEY,
    slowMs: 15_000,
    failMs: 45_000,
    moduleMs: 60_000,
  };
  const scripts = () => doc.body.children.filter((c: FakeElement) => c.tagName === "SCRIPT") as (FakeElement & { src: string; type: string; onerror: () => void })[];
  const start = () => boot(win as unknown as Window, doc as unknown as Document, cfg);
  return { doc, root, win, requests, emit, $, start, scripts, reloads: () => reloads, en: UI_LOCALES.en.loading };
}

const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("the preloader on the page", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fetches every start file at once, the bar moving by bytes, then adds the module script", async () => {
    const p = page();
    p.start();
    expect(p.requests.map((r) => r.url)).toEqual(["./main.js", "./chunks/three.js"]);
    expect(p.$("item").textContent).toBe(p.en.loading);
    expect(p.$("bytes").textContent).toBe("0.0 / 0.0 MB");
    const [a, b] = [streamed(), streamed()];
    p.requests[0].resolve(a.res);
    p.requests[1].resolve(b.res);
    a.push(1000);
    b.push(1000);
    await tick();
    expect(p.$("pct").textContent).toBe("50%");
    a.end();
    await tick();
    expect(p.scripts()).toHaveLength(0);
    b.push(2000);
    b.end();
    await tick();
    expect(p.$("pct").textContent).toBe("100%");
    const [s] = p.scripts();
    expect(s.type).toBe("module");
    expect(s.src).toBe("./main.js");
    expect(p.root.className).toBe("");
  });

  it("a 404 (a stale page naming a chunk that's gone): the failure at once with Retry; a second failure offers Reload", async () => {
    const p = page();
    p.start();
    p.requests[1].resolve(streamed(404).res);
    await tick();
    expect(p.root.className).toBe("error");
    expect(p.$("item").textContent).toBe(p.en.failed);
    expect(p.$("retry").textContent).toBe(p.en.retry);
    expect(p.$("err").textContent).toBe("./chunks/three.js: 404");
    expect(p.requests[0].signal!.aborted).toBe(true); // the rest stopped
    (p.$("retry") as unknown as { onclick: () => void }).onclick();
    expect(p.root.className).toBe("");
    expect(p.requests).toHaveLength(4); // both files again
    p.requests[2].reject(new TypeError("Failed to fetch"));
    await tick();
    expect(p.$("retry").textContent).toBe(p.en.reload);
    (p.$("retry") as unknown as { onclick: () => void }).onclick();
    expect(p.reloads()).toBe(1);
  });

  it("no byte for 15 s: the slow line; bytes again: gone; 45 s: aborted, the failure", async () => {
    const p = page();
    p.start();
    const a = streamed();
    p.requests[0].resolve(a.res);
    vi.advanceTimersByTime(15_000);
    expect(p.$("slow").hidden).toBe(false);
    expect(p.$("slow").textContent).toBe(p.en.slow);
    a.push(10);
    await tick();
    expect(p.$("slow").hidden).toBe(true);
    vi.advanceTimersByTime(45_000);
    await tick();
    expect(p.root.className).toBe("error");
    expect(p.$("err").textContent).toBe("stalled");
    expect(p.requests.every((r) => r.signal!.aborted)).toBe(true);
  });

  it("offline, then the connection back: one retry by itself", async () => {
    const p = page();
    p.start();
    p.requests[0].reject(new TypeError("Failed to fetch"));
    await tick();
    expect(p.root.className).toBe("error");
    p.emit("online");
    expect(p.requests).toHaveLength(4);
    expect(p.root.className).toBe("");
    p.emit("online"); // not failed now: nothing
    expect(p.requests).toHaveLength(4);
  });

  it("the module script's error, or a script error before the game boots: the failure, with Reload (a module graph can't be imported again)", async () => {
    const p = page();
    p.start();
    for (const r of p.requests) {
      const s = streamed();
      r.resolve(s.res);
      s.end();
    }
    await tick();
    p.scripts()[0].onerror();
    expect(p.root.className).toBe("error");
    expect(p.$("retry").textContent).toBe(p.en.reload);
    const q = page();
    q.start();
    q.emit("error", { error: new Error("boom") });
    expect(q.root.className).toBe("error");
    expect(q.$("err").textContent).toBe("boom");
    expect(q.$("retry").textContent).toBe(q.en.retry); // still fetching: the fetches can run again
  });

  it("once the game says it booted, the preloader stays out of it; no boot in 60 s after the module script: the failure", async () => {
    const p = page();
    p.start();
    for (const r of p.requests) {
      const s = streamed();
      r.resolve(s.res);
      s.end();
    }
    await tick();
    vi.advanceTimersByTime(59_999);
    expect(p.root.className).toBe("");
    vi.advanceTimersByTime(1);
    expect(p.root.className).toBe("error");
    const q = page();
    q.start();
    q.win.__stBooted = true;
    q.emit("unhandledrejection", { reason: new Error("later") });
    q.requests[0].reject(new TypeError("x"));
    await tick();
    expect(q.root.className).toBe("");
  });

  it("file://: says to serve the folder; the language: the remembered reading language's", async () => {
    const p = page({ protocol: "file:" });
    p.start();
    p.requests[0].reject(new TypeError("Failed to fetch"));
    await tick();
    expect(p.$("item").textContent).toBe(p.en.file);
    const b = page({ settings: '{"learner":"bn"}' });
    b.start();
    expect(b.$("item").textContent).toBe(UI_LOCALES.bn.loading.loading);
  });
});
