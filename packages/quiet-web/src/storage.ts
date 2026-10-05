import { fromLocalStorage, type KeyValue } from "@silver-tongue/web-common";

let installed: KeyValue | undefined;

/** main.tsx installs the page's key-value store (lab prefix included) once; every direct read/write goes through it. */
export function installPageStorage(kv: KeyValue): void {
  installed = kv;
}

/** The installed store, else plain localStorage (looked up on each call, so it may throw: callers keep their try/catch). */
export function pageStorage(): KeyValue {
  return installed ?? fromLocalStorage(globalThis.localStorage);
}
