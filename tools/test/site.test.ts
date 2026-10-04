import { describe, expect, it } from "vitest";
import { siteCatalog } from "../src/site";

describe("site catalog", () => {
  it("offers Korean, Chinese and Japanese, in that order, nothing else", () => {
    const catalog = [{ id: "ja-japan" }, { id: "xx-test" }, { id: "zh-china" }, { id: "ko-seoul" }];
    expect(siteCatalog(catalog).map((c) => c.id)).toEqual(["ko-seoul", "zh-china", "ja-japan"]);
  });

  it("fails loudly when a course is missing", () => {
    expect(() => siteCatalog([{ id: "zh-china" }])).toThrow(/ko-seoul/);
  });
});
