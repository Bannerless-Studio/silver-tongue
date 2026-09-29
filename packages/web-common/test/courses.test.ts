import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@silver-tongue/core";
import { coursesBase, hasAnySession, metaContent, pageStart, type MetaSource } from "../src/courses";

const doc = (metas: Record<string, string>): MetaSource => ({
  querySelector: (sel) => {
    const name = /meta\[name="([^"]+)"\]/.exec(sel)?.[1];
    return name && name in metas ? { getAttribute: () => metas[name] } : null;
  },
});

describe("page metas", () => {
  it("reads a meta's content, empty when it is missing", () => {
    expect(metaContent(doc({ "st-vn": "../" }), "st-vn")).toBe("../");
    expect(metaContent(doc({}), "st-vn")).toBe("");
  });

  it("finds the courses next to the page unless a meta says where", () => {
    expect(coursesBase(doc({}))).toBe("courses/");
    expect(coursesBase(doc({ "st-courses": "../courses/" }))).toBe("../courses/");
  });
});

describe("a page made for one course", () => {
  const entry = (id: string, learners = ["en"]) => ({ id, language: id.slice(0, 2), learners }) as unknown as CatalogEntry;
  const catalog = [entry("zh-china"), entry("ko-seoul")];
  const kv = (keys: string[]) => ({ getItem: () => null, setItem: () => {}, removeItem: () => {}, keys: () => keys });

  it("tells whether this browser has a game for any course", () => {
    expect(hasAnySession(kv([]))).toBe(false);
    expect(hasAnySession(kv(["silver-tongue:settings", "silver-tongue:zh-china:meta"]))).toBe(false);
    expect(hasAnySession(kv(["silver-tongue:zh-china:session:2026-09-25-143005"]))).toBe(true);
    expect(hasAnySession({ ...kv([]), keys: () => { throw new Error("no storage"); } })).toBe(false);
  });

  it("starts a first visit on the page's course and makes it the player's", () => {
    expect(pageStart(catalog, {}, "ko-seoul", false)).toEqual({ start: { ask: false, course: catalog[1], learner: "en" }, remember: true });
  });

  it("starts a player with games on it for this visit only, their own course kept", () => {
    expect(pageStart(catalog, { course: "zh-china" }, "ko-seoul", true)).toEqual({ start: { ask: false, course: catalog[1], learner: "en" }, remember: false });
  });

  it("without the meta, or naming a course the catalog lacks, starts as before", () => {
    expect(pageStart(catalog, {}, "", false)).toEqual({ start: { ask: true }, remember: true });
    expect(pageStart(catalog, { course: "zh-china" }, "xx-nowhere", true)).toEqual({ start: { ask: false, course: catalog[0], learner: "en" }, remember: true });
  });
});
