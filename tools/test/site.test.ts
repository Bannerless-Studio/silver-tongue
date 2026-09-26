import { describe, expect, it } from "vitest";
import { sitePages } from "../src/site";

const vn = `<meta name="st-courses" content="courses/" /><meta name="st-text" content="" />`;
const text = `<meta name="st-courses" content="courses/" /><meta name="st-vn" content="" />`;

describe("site pages", () => {
  it("links the pages to each other and points the text page at the shared courses", () => {
    const out = sitePages(vn, text);
    expect(out.vn).toBe(`<meta name="st-courses" content="courses/" /><meta name="st-text" content="text/" />`);
    expect(out.text).toBe(`<meta name="st-courses" content="../courses/" /><meta name="st-vn" content="../" />`);
  });

  it("fails loudly when a page lacks its metas", () => {
    expect(() => sitePages("<html>", text)).toThrow(/st-text/);
    expect(() => sitePages(vn, "<html>")).toThrow(/st-courses/);
  });
});
