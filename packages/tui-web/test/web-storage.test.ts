import { describe, expect, it } from "vitest";
import { newGame, serialize } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { WebSessions, type KeyValue } from "../src/web-storage";

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
