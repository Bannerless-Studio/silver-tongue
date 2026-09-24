import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  decayIntervalMs,
  pickPreferred,
  rankFor,
  recordHelp,
  recordRight,
  recordSeen,
  recordWrong,
  replyModeFor,
  wordState,
} from "../src/learner";
import type { WordRecord } from "../src/types";

const T0 = 1_000_000;
const rightTimes = (n: number, now = T0) => {
  let r: WordRecord | undefined;
  for (let i = 0; i < n; i++) r = recordRight(r, now);
  return r!;
};

describe("word state", () => {
  it("moves unseen -> met -> known", () => {
    expect(wordState(undefined, T0)).toBe("unseen");
    expect(wordState(recordSeen(undefined, T0), T0)).toBe("met");
    expect(wordState(rightTimes(2), T0)).toBe("met");
    expect(wordState(rightTimes(3), T0)).toBe("known");
  });

  it("a miss or a help makes a word shaky until the next right answer", () => {
    expect(wordState(recordWrong(rightTimes(5), T0), T0)).toBe("shaky");
    expect(wordState(recordHelp(rightTimes(5), T0), T0)).toBe("shaky");
    expect(wordState(recordRight(recordWrong(undefined, T0), T0), T0)).toBe("met");
  });

  it("known words decay to shaky after an interval that grows with the streak", () => {
    expect(decayIntervalMs(3)).toBe(2 * DAY_MS);
    expect(decayIntervalMs(4)).toBe(4 * DAY_MS);
    expect(decayIntervalMs(20)).toBe(60 * DAY_MS);
    const r = rightTimes(3);
    expect(wordState(r, T0 + 2 * DAY_MS)).toBe("known");
    expect(wordState(r, T0 + 2 * DAY_MS + 1)).toBe("shaky");
    expect(wordState(rightTimes(5), T0 + 8 * DAY_MS + 1)).toBe("shaky");
  });

  it("seeing a decayed word keeps it shaky until it is answered right", () => {
    const later = T0 + 3 * DAY_MS;
    const seenAgain = recordSeen(rightTimes(3), later);
    expect(wordState(seenAgain, later)).toBe("shaky");
    expect(wordState(recordRight(seenAgain, later), later)).toBe("known");
  });
});

describe("reply mode", () => {
  it("follows the weakest hinge word", () => {
    expect(replyModeFor([], false)).toBe("pick");
    expect(replyModeFor(["known", "met"], false)).toBe("pick");
    expect(replyModeFor(["known", "shaky"], false)).toBe("tiles");
    expect(replyModeFor(["known"], false)).toBe("tiles");
    expect(replyModeFor(["known"], true)).toBe("type");
  });
});

describe("pickPreferred", () => {
  const records = { a: recordWrong(undefined, T0), b: recordSeen(undefined, T0) };
  const wordsOf = (c: string) => [c];
  it("prefers shaky, then met, then anything", () => {
    expect(pickPreferred(["c", "b", "a"], wordsOf, records, T0, () => 0.99)).toBe("a");
    expect(pickPreferred(["c", "b"], wordsOf, records, T0, () => 0.99)).toBe("b");
    expect(pickPreferred(["c", "d"], wordsOf, records, T0, () => 0.99)).toBe("d");
  });

  it("judges a multi-word candidate by its weakest word, and refuses an empty list", () => {
    expect(pickPreferred([["c"], ["b", "a"]], (c) => c, records, T0, () => 0)).toEqual(["b", "a"]);
    expect(() => pickPreferred([], wordsOf, records, T0, () => 0)).toThrow(/no candidates/);
  });
});

describe("rank", () => {
  it("is the share of course words known", () => {
    const ids = ["a", "b", "c", "d", "e"];
    expect(rankFor({}, ids, T0)).toBe(0);
    expect(rankFor({ a: rightTimes(3) }, ids, T0)).toBe(1);
    expect(rankFor(Object.fromEntries(ids.slice(0, 4).map((i) => [i, rightTimes(3)])), ids, T0)).toBe(3);
    expect(rankFor(Object.fromEntries(ids.map((i) => [i, rightTimes(3)])), ids, T0)).toBe(4);
  });
});
