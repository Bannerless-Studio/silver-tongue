import { describe, expect, it } from "vitest";
import { newGame, serialize } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { loadWebSettings, migrateWebAliases, saveWebSettings, SETTINGS_KEY, updateWebSettings, WebSessions, type KeyValue } from "../src/web-storage";

/** An in-memory localStorage. */
class FakeStorage implements KeyValue {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  keys() {
    return [...this.data.keys()];
  }
}

const course = fixtureCourse();
const T = Date.UTC(2026, 8, 25, 14, 30, 5);

describe("web sessions", () => {
  it("starts a new game when there is none, and continues the one saved last", () => {
    const kv = new FakeStorage();
    let now = T;
    const s = new WebSessions(kv, course, () => now);
    const first = s.continueLast();
    expect(first).toMatchObject({ id: "2026-09-25-143005", readOnly: false, state: newGame(course) });
    expect(s.save(first.id, { ...first.state, day: 2 })).toBe(true);
    now += 60_000;
    const second = s.startNew();
    expect(second.id).toBe("2026-09-25-143105");
    s.save(second.id, second.state);
    expect(new WebSessions(kv, course, () => now).continueLast().id).toBe(second.id);
    expect(s.list().map((x) => x.id)).toEqual([second.id, first.id]);
    expect(s.open(first.id).state.day).toBe(2);
  });

  it("keeps an unreadable save as a backup and starts fresh with a notice", () => {
    const kv = new FakeStorage();
    const s = new WebSessions(kv, course, () => T);
    const g = s.continueLast();
    s.save(g.id, g.state);
    kv.setItem(`silver-tongue:${course.id}:session:${g.id}`, "{");
    const again = s.continueLast();
    expect(again.notice).toBe("notice-bad-save");
    expect(again.state).toEqual(newGame(course));
    expect(kv.keys().some((k) => k.includes(":invalid-backup:"))).toBe(true);
  });

  it("recovers from a corrupted index instead of getting stuck", () => {
    const kv = new FakeStorage();
    kv.setItem(`silver-tongue:${course.id}:meta`, '{"played":null}');
    const s = new WebSessions(kv, course, () => T);
    const g = s.continueLast();
    expect(s.save(g.id, g.state)).toBe(true);
  });

  it("adds an imported game as a new session", () => {
    const kv = new FakeStorage();
    const s = new WebSessions(kv, course, () => T);
    const id = s.add({ ...newGame(course), day: 9 });
    expect(id).not.toBeNull();
    expect(s.list()[0]).toMatchObject({ id, state: { day: 9 } });
  });

  it("plays on read-only when storage throws", () => {
    const broken: KeyValue = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {},
      keys: () => [],
    };
    const s = new WebSessions(broken, course, () => T);
    expect(s.continueLast()).toMatchObject({ readOnly: true, notice: "notice-read-only" });
    expect(s.save("x", newGame(course))).toBe(false);
    expect(s.list()).toEqual([]);
  });

  it("stores each save as the same JSON the terminal game writes", () => {
    const kv = new FakeStorage();
    const s = new WebSessions(kv, course, () => T);
    const g = s.continueLast();
    s.save(g.id, g.state);
    expect(kv.getItem(`silver-tongue:${course.id}:session:${g.id}`)).toBe(serialize(g.state));
  });
});

describe("settings and old course ids", () => {
  it("saves settings and ignores a broken value", () => {
    const kv = new FakeStorage();
    expect(loadWebSettings(kv)).toEqual({});
    expect(saveWebSettings(kv, { course: "zh-china", learner: "en" })).toBe(true);
    expect(loadWebSettings(kv)).toEqual({ course: "zh-china", learner: "en" });
    kv.setItem(SETTINGS_KEY, "{bad");
    expect(loadWebSettings(kv)).toEqual({});
  });

  it("changes one setting without losing the others", () => {
    const kv = new FakeStorage();
    const kept = { course: "zh-other", learner: "en", speed: "slow", autoAdvance: true };
    // A value the game does not understand is dropped rather than carried forward.
    kv.setItem(SETTINGS_KEY, '{"course":"zh-china","learner":"en","speed":"slow","autoAdvance":true,"junk":1}');
    expect(updateWebSettings(kv, { course: "zh-other" })).toEqual(kept);
    expect(loadWebSettings(kv)).toEqual(kept);
  });

  it("moves alias keys and keeps the last game", () => {
    const kv = new FakeStorage();
    const aliased = { ...fixtureCourse(), aliases: ["old"] };
    const state = { ...newGame(aliased), course: "old" };
    kv.setItem("silver-tongue:old:session:a", serialize(state));
    kv.setItem("silver-tongue:old:session:b", serialize(state));
    kv.setItem("silver-tongue:old:invalid-backup:b:x", "junk");
    kv.setItem("silver-tongue:old:meta", JSON.stringify({ last: "a", played: { a: 5, b: 3 } }));
    kv.setItem(`silver-tongue:${aliased.id}:session:b`, serialize(newGame(aliased)));
    migrateWebAliases(kv, aliased);
    expect(kv.keys().filter((k) => k.startsWith("silver-tongue:old:"))).toEqual([]);
    const sessions = new WebSessions(kv, aliased, () => 10);
    expect(sessions.list().map((x) => x.id)).toEqual(["a", "b-2", "b"]);
    expect(sessions.continueLast().id).toBe("a");
    expect(kv.getItem(`silver-tongue:${aliased.id}:invalid-backup:b:x`)).toBe("junk");
  });

  it("keeps play times and the last game when storage fills up partway through the move", () => {
    const kv = new FakeStorage();
    const aliased = { ...fixtureCourse(), aliases: ["old"] };
    kv.setItem("silver-tongue:old:session:a", serialize({ ...newGame(aliased), course: "old" }));
    kv.setItem("silver-tongue:old:session:b", serialize({ ...newGame(aliased), course: "old" }));
    kv.setItem("silver-tongue:old:meta", JSON.stringify({ last: "a", played: { a: 5, b: 3 } }));
    let room = 2;
    const set = kv.setItem.bind(kv);
    kv.setItem = (k, v) => {
      if (room-- <= 0) throw new Error("quota");
      set(k, v);
    };
    migrateWebAliases(kv, aliased);
    room = Infinity;
    migrateWebAliases(kv, aliased);
    expect(kv.keys().filter((k) => k.startsWith("silver-tongue:old:"))).toEqual([]);
    const sessions = new WebSessions(kv, aliased, () => 10);
    expect(sessions.list().map((x) => [x.id, x.lastPlayed])).toEqual([["a", 5], ["b", 3]]);
    expect(sessions.continueLast().id).toBe("a");
  });

  it("keeps the newer game last when both ids have games", () => {
    const kv = new FakeStorage();
    const aliased = { ...fixtureCourse(), aliases: ["old"] };
    kv.setItem("silver-tongue:old:session:a", serialize({ ...newGame(aliased), course: "old" }));
    kv.setItem("silver-tongue:old:meta", JSON.stringify({ last: "a", played: { a: 5 } }));
    kv.setItem(`silver-tongue:${aliased.id}:session:n`, serialize(newGame(aliased)));
    kv.setItem(`silver-tongue:${aliased.id}:meta`, JSON.stringify({ last: "n", played: { n: 9 } }));
    migrateWebAliases(kv, aliased);
    expect(new WebSessions(kv, aliased, () => 10).continueLast().id).toBe("n");
  });
});
