import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@silver-tongue/core";
import { coursesBase, labMode, metaContent, pageStart, type MetaSource } from "../src/courses";

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

  it("starts a first visit on the page's course", () => {
    expect(pageStart(catalog, {}, "ko-seoul")).toEqual({ ask: false, course: catalog[1], learner: "en" });
  });

  it("starts a player who chose a course on their own choice, so a switch in settings sticks", () => {
    expect(pageStart(catalog, { course: "zh-china" }, "ko-seoul")).toEqual({ ask: false, course: catalog[0], learner: "en" });
    expect(pageStart(catalog, { course: "ko-seoul" }, "ko-seoul")).toEqual({ ask: false, course: catalog[1], learner: "en" });
  });

  it("without the meta, or naming a course the catalog lacks, starts as before", () => {
    expect(pageStart(catalog, {}, "")).toEqual({ ask: true });
    expect(pageStart(catalog, { course: "zh-china" }, "xx-nowhere")).toEqual({ ask: false, course: catalog[0], learner: "en" });
  });
});

describe("lab mode", () => {
  it("is on only when the st-lab meta says on", () => {
    expect(labMode(doc({ "st-lab": "on" }))).toBe(true);
    expect(labMode(doc({ "st-lab": "" }))).toBe(false);
    expect(labMode(doc({}))).toBe(false);
  });
});
