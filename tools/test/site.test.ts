import { describe, expect, it } from "vitest";
import { sitePages } from "../src/site";

const vn = `<meta name="st-courses" content="courses/" /><meta name="st-text" content="" /><meta name="st-quiet" content="" />`;
const text = `<meta name="st-courses" content="courses/" /><meta name="st-vn" content="" /><meta name="st-quiet" content="" />`;
const quiet = `<meta name="st-courses" content="courses/" /><meta name="st-text" content="" /><meta name="st-vn" content="" /><meta name="st-course" content="" />`;

describe("site pages", () => {
  it("links the pages to each other and points the text page at the shared courses", () => {
    const out = sitePages(vn, text, quiet);
    expect(out.vn).toBe(`<meta name="st-courses" content="courses/" /><meta name="st-text" content="text/" /><meta name="st-quiet" content="quiet/" />`);
    expect(out.text).toBe(`<meta name="st-courses" content="../courses/" /><meta name="st-vn" content="../" /><meta name="st-quiet" content="../quiet/" />`);
    expect(out.quiet).toBe(`<meta name="st-courses" content="../courses/" /><meta name="st-text" content="../text/" /><meta name="st-vn" content="../" /><meta name="st-course" content="" />`);
  });

  it("serves the quiet terminal at /ko/ starting on the Korean game, /quiet/ left as it was", () => {
    const out = sitePages(vn, text, quiet);
    expect(out.ko).toBe(`<meta name="st-courses" content="../courses/" /><meta name="st-text" content="../text/" /><meta name="st-vn" content="../" /><meta name="st-course" content="ko-seoul" />`);
    const noCourseMeta = quiet.replace(`<meta name="st-course" content="" />`, "");
    expect(() => sitePages(vn, text, noCourseMeta)).toThrow(/st-course"/);
  });

  it("fails loudly when a page lacks its metas", () => {
    expect(() => sitePages("<html>", text, quiet)).toThrow(/st-text/);
    expect(() => sitePages(vn, "<html>", quiet)).toThrow(/st-courses/);
    expect(() => sitePages(vn, text, "<html>")).toThrow(/st-courses/);
  });
});
