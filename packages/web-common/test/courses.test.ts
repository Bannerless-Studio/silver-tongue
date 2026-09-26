import { describe, expect, it } from "vitest";
import { coursesBase, metaContent, type MetaSource } from "../src/courses";

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
