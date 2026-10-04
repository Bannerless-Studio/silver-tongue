import { describe, expect, it } from "vitest";
import { sitePage } from "../src/site";

const quiet = `<meta name="st-courses" content="courses/" /><meta name="st-text" content="" /><meta name="st-vn" content="" /><meta name="st-course" content="" />`;

describe("site page", () => {
  it("serves the quiet terminal at / starting on the Korean game, with no links to other pages", () => {
    expect(sitePage(quiet)).toBe(`<meta name="st-courses" content="courses/" /><meta name="st-text" content="" /><meta name="st-vn" content="" /><meta name="st-course" content="ko-seoul" />`);
  });

  it("fails loudly when the page lacks its course meta", () => {
    expect(() => sitePage("<html>")).toThrow(/st-course"/);
  });
});
