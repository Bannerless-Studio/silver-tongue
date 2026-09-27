// What keeps the way to the title screen from ever sitting silent or forever, once the game's JS
// runs (before it: preload.js, with the same Watchdog and retryAction):
//   StartWatch   while any startup step is pending (main.ts tracks each: the catalog, the town,
//                the course, the start flow's chunk), no progress for slowMs shows the loading
//                screen's "Slow connection" line; none for failMs rejects every pending step with a
//                StallError (and aborts what is in flight, onStall), which the step's retry loop shows
//   JsonFetcher  fetch + JSON with its own no-progress abort (stallMs between chunks), each chunk
//                progress for the StartWatch; every JSON the page loads goes through it
//   retrying     a step run until it works: each failure waits on the screen's button (retryAction:
//                Retry while it can be re-run, Reload after `retries` failures or when it can't)
import { retryAction, Watchdog, type RetryAction } from "./preload.js";

/** No progress for too long. */
export class StallError extends Error {
  override name = "StallError";
}
/** No WebGL (off, blocked, no GPU): a specific message, and running the step again won't help. */
export class WebGLError extends Error {
  override name = "WebGLError";
}
/** A module import that failed: the browser keeps that failure until the page reloads. */
export class ModuleLoadError extends Error {
  override name = "ModuleLoadError";
}

/** Whether running the failed step again can mend it (else the button reloads). */
export const rerunnable = (e: unknown) => !(e instanceof WebGLError) && !(e instanceof ModuleLoadError);

export interface StartWatchOptions {
  slowMs: number;
  failMs: number;
  onSlow(on: boolean): void;
  /** the stall: abort what is in flight (the pending steps are rejected already) */
  onStall?(): void;
}

export class StartWatch {
  private dog: Watchdog;
  private pending = 0;
  private stalls = new Set<(e: Error) => void>();

  constructor(private o: StartWatchOptions) {
    this.dog = new Watchdog({ slowMs: o.slowMs, failMs: o.failMs, onSlow: (on) => o.onSlow(on), onFail: () => this.stalled() });
  }

  /** steps pending now */
  get busy(): number {
    return this.pending;
  }

  /** Progress (bytes came): the watch starts counting again. */
  poke() {
    this.dog.poke();
  }

  /** `p`, rejected with a StallError when no progress comes for failMs while it (or any other step) is pending. */
  track<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let live = true;
      const finish = () => {
        if (!live) return false;
        live = false;
        this.stalls.delete(stall);
        if (--this.pending === 0) this.dog.stop();
        else this.dog.poke(); // a step done is progress
        return true;
      };
      const stall = (e: Error) => {
        if (finish()) reject(e);
      };
      this.stalls.add(stall);
      if (this.pending++ === 0 || !this.dog.on) this.dog.start();
      else this.dog.poke();
      p.then(
        (v) => {
          if (finish()) resolve(v);
        },
        (e: unknown) => {
          if (finish()) reject(e);
        },
      );
    });
  }

  private stalled() {
    const e = new StallError(`no data for ${Math.round(this.o.failMs / 1000)} s`);
    for (const s of [...this.stalls]) s(e);
    this.o.onStall?.();
  }
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** fetch + JSON that can't hang: no chunk for stallMs aborts it (a StallError); abortAll() stops every one in flight. */
export class JsonFetcher {
  /** the fetches in flight: each one's abort (with its reason) */
  private live = new Set<(reason: string) => void>();

  constructor(private o: { fetch: FetchFn; stallMs: number; onBytes?: () => void }) {}

  get = async <T>(url: string): Promise<T> => {
    const ctrl = new AbortController();
    let why: string | null = null;
    const stop = (reason: string) => {
      why = reason;
      ctrl.abort();
    };
    const dog = new Watchdog({ slowMs: this.o.stallMs, failMs: this.o.stallMs, onSlow: () => {}, onFail: () => stop(`no data for ${Math.round(this.o.stallMs / 1000)} s`) });
    this.live.add(stop);
    dog.start();
    try {
      const res = await this.o.fetch(url, { signal: ctrl.signal });
      dog.poke();
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      let text = "";
      const reader = res.body?.getReader();
      if (!reader) text = await res.text();
      else {
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          dog.poke();
          this.o.onBytes?.();
        }
        text += dec.decode();
      }
      return JSON.parse(text) as T;
    } catch (e) {
      if (why) throw new StallError(`${url}: ${why}`);
      throw e;
    } finally {
      dog.stop();
      this.live.delete(stop);
    }
  };

  /** Aborts every fetch in flight (a StartWatch stall): each rejects with a StallError. */
  abortAll() {
    for (const stop of [...this.live]) stop("stalled");
  }
}

/**
 * Runs `run` until it resolves. Each failure goes to `ask` with what its button does (retryAction:
 * "retry" while `rerunnable(e)` and at most `retries` failures came before, else "reload"); `ask`
 * resolves when the step should run again (a "reload" never resolves: the page goes).
 */
export async function retrying<T>(run: () => Promise<T>, ask: (e: unknown, action: RetryAction) => Promise<void>, retries = 2): Promise<T> {
  for (let failures = 1; ; failures++) {
    try {
      return await run();
    } catch (e) {
      await ask(e, retryAction(failures, rerunnable(e), retries));
    }
  }
}

/**
 * Something the page can do without for now (the sound manifest): tried at once, and again at
 * each kick() (the connection back, the next gesture) until it has loaded once; never waited on,
 * never stopped by a StartWatch stall. `use` gets the value once it is in (at once if it is).
 */
export class LateLoad<T> {
  private value: { v: T } | null = null;
  private busy = false;
  private users: ((v: T) => void)[] = [];

  constructor(private get: () => Promise<T>) {}

  get loaded(): boolean {
    return !!this.value;
  }

  kick() {
    if (this.value || this.busy) return;
    this.busy = true;
    this.get().then(
      (v) => {
        this.busy = false;
        this.value = { v };
        for (const f of this.users.splice(0)) f(v);
      },
      () => {
        this.busy = false; // the next kick tries again
      },
    );
  }

  use(f: (v: T) => void) {
    if (this.value) f(this.value.v);
    else this.users.push(f);
  }
}
