import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fromLocalStorage, labKeyValue } from "@silver-tongue/web-common";
import { scribeCountKey } from "@silver-tongue/view";
import { installPageStorage, pageStorage } from "../src/storage";
import { finishTilesHint, tilesHintDone } from "../src/ui/Stage";
import { scribeRound } from "../src/scribe";

function fakeLocalStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage & { map: Map<string, string> };
}

describe("page storage under the lab wrapper", () => {
  let ls: ReturnType<typeof fakeLocalStorage>;
  beforeEach(() => {
    ls = fakeLocalStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
    installPageStorage(labKeyValue(fromLocalStorage(ls)));
  });
  afterEach(() => {
    installPageStorage(undefined as never);
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("tiles hint lands under the lab prefix", () => {
    finishTilesHint("ko-seoul");
    expect([...ls.map.keys()]).toEqual(["silver-tongue-lab:tiles-hint:ko-seoul"]);
    expect(tilesHintDone("ko-seoul")).toBe(true);
  });

  it("plain keys stay untouched and unseen", () => {
    ls.setItem("silver-tongue:tiles-hint:ko-seoul", "1");
    expect(tilesHintDone("ko-seoul")).toBe(false);
    expect(ls.getItem("silver-tongue:tiles-hint:ko-seoul")).toBe("1");
  });

  it("scribe counter lands under the lab prefix", () => {
    scribeRound({}, "ko-seoul", 1);
    const keys = [...ls.map.keys()];
    expect(keys).toEqual([scribeCountKey("ko-seoul").replace("silver-tongue:", "silver-tongue-lab:")]);
  });

  it("defaults to plain localStorage when nothing is installed", () => {
    installPageStorage(undefined as never);
    pageStorage().setItem("silver-tongue:x", "1");
    expect(ls.getItem("silver-tongue:x")).toBe("1");
  });
});
