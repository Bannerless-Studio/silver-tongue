// The loading screen (#loading in index.html; page.css .ld-*): the game's title, a bar with the
// percent and bytes (loading.ts loadSummary), and the file loading now. Up at the start while the
// town's first views load; again over a door whose room hasn't landed yet, only when that takes
// longer than `delay` (a prefetched room goes in behind the fade with no screen at all). It takes
// #loading over from the page's preloader (preload.js) with the same card: a "Slow connection"
// line (slow(), boot.ts StartWatch), and a failure (fail()) with Retry / Reload, the error in
// small type under it; the connection coming back (online()) presses Retry once by itself.
import { FALLBACK_UI, UI_LOCALES, type LoadingText } from "../../locale";
import { progressLabel, type LoadSummary } from "../loading";
import type { RetryAction } from "../preload.js";

/** The fallback UI language's strings (locale/en.json `loading`), for a screen made without any. */
export const LOADING_FALLBACK: LoadingText = UI_LOCALES[FALLBACK_UI].loading;

export class LoadingScreen {
  private fill: HTMLElement;
  private pct: HTMLElement;
  private bytes: HTMLElement;
  private item: HTMLElement;
  private slowLine: HTMLElement;
  private button: HTMLButtonElement;
  private detail: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** requests holding the screen up (the start, a room being loaded) */
  private holds = 0;
  /** the failed steps waiting for Retry (fail()) */
  private waiters: (() => void)[] = [];
  private action: RetryAction = "retry";
  /** online() already pressed Retry for this failure */
  private autoRetried = false;

  constructor(
    readonly root: HTMLElement,
    title = "Silver Tongue",
    readonly text: LoadingText = LOADING_FALLBACK,
    private reload: () => void = () => location.reload(),
  ) {
    root.replaceChildren();
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    const card = document.createElement("div");
    card.className = "ld-card";
    const h = document.createElement("h1");
    h.className = "ld-title";
    h.textContent = title;
    const bar = document.createElement("div");
    bar.className = "ld-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    this.fill = document.createElement("div");
    this.fill.className = "ld-fill";
    bar.append(this.fill);
    const line = document.createElement("p");
    line.className = "ld-line";
    this.pct = document.createElement("b");
    this.pct.className = "ld-pct";
    this.bytes = document.createElement("span");
    this.bytes.className = "ld-bytes";
    line.append(this.pct, this.bytes);
    this.item = document.createElement("p");
    this.item.className = "ld-item";
    this.slowLine = document.createElement("p");
    this.slowLine.className = "ld-slow";
    this.slowLine.textContent = text.slow;
    this.slowLine.hidden = true;
    this.button = document.createElement("button");
    this.button.className = "ld-retry st-btn primary";
    this.button.type = "button";
    this.button.addEventListener("click", () => this.press());
    this.detail = document.createElement("p");
    this.detail.className = "ld-err";
    card.append(h, bar, line, this.item, this.slowLine, this.button, this.detail);
    root.classList.remove("error");
    root.append(card);
    this.render(null);
  }

  /** "Slow connection, still loading…" under the bar (no byte for a while), or not. */
  slow(on: boolean) {
    this.slowLine.hidden = !on;
  }

  get failed(): boolean {
    return this.root.classList.contains("error");
  }

  /**
   * A step couldn't load: `message` instead of the bar, `detail` (the error) small under it, and
   * the button: "retry" resolves the promise (the step runs again) when it is pressed, "reload"
   * reloads the page. Steps failing together share the screen: one press retries them all, and
   * the button reloads if any of them needs that.
   */
  fail(message: string, detail: string, action: RetryAction): Promise<void> {
    if (!this.failed) this.action = action;
    else if (action === "reload") this.action = "reload";
    this.autoRetried = false;
    this.root.hidden = false;
    this.root.classList.add("error");
    this.item.textContent = message;
    this.detail.textContent = detail;
    this.button.textContent = this.action === "retry" ? this.text.retry : this.text.reload;
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  /** The browser is online again: a failure showing presses its button once by itself. */
  online() {
    if (!this.failed || this.autoRetried) return;
    this.autoRetried = true;
    this.press();
  }

  private press() {
    if (!this.failed) return;
    if (this.action === "reload") return this.reload();
    const waiting = this.waiters;
    this.waiters = [];
    this.root.classList.remove("error");
    this.slow(false);
    this.item.textContent = "";
    if (this.holds === 0) this.hide();
    for (const w of waiting) w();
  }

  /** The bar for a summary (null: nothing counted yet). */
  render(p: LoadSummary | null) {
    const f = p ? p.fraction : 0;
    const pc = Math.floor(f * 100);
    this.fill.style.width = `${(f * 100).toFixed(1)}%`;
    this.fill.parentElement?.setAttribute("aria-valuenow", String(pc));
    this.pct.textContent = `${pc}%`;
    this.bytes.textContent = p && p.count ? progressLabel(p) : "";
    this.item.textContent = p?.current ?? "";
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Holds the screen up, shown at once or after `delay` ms; `release()` lets it go (hidden when no hold is left). */
  hold(delay = 0): () => void {
    this.holds++;
    if (delay <= 0) this.show();
    else if (!this.visible && !this.timer)
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.holds > 0) this.show();
      }, delay);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds = Math.max(0, this.holds - 1);
      if (this.holds === 0) this.hide();
    };
  }

  private show() {
    this.root.hidden = false;
  }

  /** Hidden (never while a failure shows: that waits for its button). */
  hide() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.failed) this.root.hidden = true;
  }

}
