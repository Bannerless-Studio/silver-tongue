import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "@silver-tongue/view/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fromLocalStorage, labKeyValue, LAB_PREFIX, WebSessions } from "@silver-tongue/web-common";
import { deskKey, lookupHintKey, papersKey, scribeCountKey } from "@silver-tongue/view";
import { DOOR_LAB_PREFIX, installPageStorage, pageStorage } from "../src/storage";
import { finishTilesHint, tilesHintDone } from "../src/ui/Stage";
import { emptyOpeningChoices } from "../src/door-choices";
import { openingKey, openingStore, scribeRound } from "../src/scribe";

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
    installPageStorage(labKeyValue(fromLocalStorage(ls), DOOR_LAB_PREFIX));
  });
  afterEach(() => {
    installPageStorage(undefined as never);
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("tiles hint lands under the lab prefix", () => {
    finishTilesHint("ko-seoul");
    expect([...ls.map.keys()]).toEqual([`${DOOR_LAB_PREFIX}tiles-hint:ko-seoul`]);
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
    expect(keys).toEqual([scribeCountKey("ko-seoul").replace("silver-tongue:", DOOR_LAB_PREFIX)]);
  });

  it("isolates old sessions, settings, paper positions, counters and opening choices on the same origin", () => {
    const course = fixtureWithText();
    const old = labKeyValue(fromLocalStorage(ls));
    const sessions = new WebSessions(old, course, () => 1000);
    sessions.save("legacy", { ...newGame(course), player: "Old player", day: 8 });
    const keys = ["silver-tongue:settings", papersKey(course.id), deskKey(course.id), lookupHintKey(course.id), scribeCountKey(course.id), openingKey(course.id, "legacy")];
    for (const k of keys) old.setItem(k, k === deskKey(course.id) ? JSON.stringify({ at: { idcard: 3 }, met: [] }) : "true");
    const originals = new Map(ls.map);
    const fresh = new WebSessions(pageStorage(), course, () => 2000);
    expect(fresh.list()).toEqual([]);
    expect(fresh.continueLast().state).toEqual(newGame(course));
    for (const k of keys) expect(pageStorage().getItem(k), k).toBeNull();
    expect(openingStore(course, "legacy").load()).toEqual(emptyOpeningChoices());
    fresh.save("door", { ...newGame(course), day: 2 });
    for (const k of keys) pageStorage().setItem(k, "door value");
    expect(new WebSessions(labKeyValue(fromLocalStorage(ls), DOOR_LAB_PREFIX), course, () => 3000).continueLast().state.day).toBe(2);
    for (const [k, v] of originals) expect(ls.getItem(k), k).toBe(v);
    expect([...ls.map.keys()].filter((k) => !originals.has(k)).every((k) => k.startsWith(DOOR_LAB_PREFIX))).toBe(true);
    expect(DOOR_LAB_PREFIX).not.toBe(LAB_PREFIX);
  });

  it("defaults to plain localStorage when nothing is installed", () => {
    installPageStorage(undefined as never);
    pageStorage().setItem("silver-tongue:x", "1");
    expect(ls.getItem("silver-tongue:x")).toBe("1");
  });
});
