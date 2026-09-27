// Types for preload.js (plain ES5, inlined into index.html by build.mjs; main.ts and the tests import it).
export function mb(n: number): string;
export function tally(files: [string, number][], got: Record<string, number>, done: Record<string, boolean>): { loaded: number; total: number; fraction: number };
export interface WatchdogOptions {
  slowMs: number;
  failMs: number;
  onSlow(on: boolean): void;
  onFail(): void;
}
export class Watchdog {
  constructor(o: WatchdogOptions);
  readonly slow: boolean;
  readonly on: boolean;
  start(): void;
  poke(): void;
  stop(): void;
}
export type RetryAction = "retry" | "reload";
export function retryAction(failures: number, rerunnable: boolean, retries: number): RetryAction;
export function pickLocale(tables: Record<string, unknown>, search: string, settings: string | null, languages: readonly (string | undefined)[], fallback: string): string;
export interface PreloadConfig {
  files: [string, number][];
  entry: string;
  s: Record<string, { loading: string; slow: string; failed: string; file: string; retry: string; reload: string }>;
  fallback: string;
  key: string;
  slowMs: number;
  failMs: number;
  moduleMs: number;
}
export function boot(win: Window, doc: Document, cfg?: PreloadConfig): void;
