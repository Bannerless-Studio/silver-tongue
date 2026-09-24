import { describe, expect, it } from "vitest";
import { convertPack, ftlValue } from "../src/import-vocab-pack";

const pack = { key: "zh", name: "Mandarin", tts: "zh-CN", levels: [{ id: "1", label: "HSK 1" }, { id: "2", label: "HSK 2" }], typing: null, spaced: false };
const words = [
  { id: "w0133", w: "茶", en: "tea; tea plant", lv: "1", pron: "chá" },
  { id: "w0900", w: "括号", en: "brackets {like these}", lv: "2" },
];

describe("import-vocab-pack", () => {
  it("escapes Fluent braces and empty values", () => {
    expect(ftlValue("a {b} c")).toBe('a {"{"}b{"}"} c');
    expect(ftlValue("  ")).toBe('{""}');
    expect(ftlValue("two\nlines")).toBe("two lines");
  });

  it("converts pack metadata, words and glosses", () => {
    const r = convertPack(pack, words);
    expect(r.meta).toEqual({
      key: "zh",
      name: "Mandarin",
      locale: "zh",
      levels: ["1", "2"],
      stages: { "1": ["1"], "2": ["2"] },
      typing: false,
      spaced: false,
    });
    expect(r.words).toEqual([
      { id: "w0133", w: "茶", lv: "1", pron: "chá" },
      { id: "w0900", w: "括号", lv: "2" },
    ]);
    expect(r.glossesFtl).toContain("w0133 = tea; tea plant\n");
    expect(r.glossesFtl).toContain('w0900 = brackets {"{"}like these{"}"}\n');
  });

  it("keeps hand-set stages on re-import", () => {
    const first = convertPack(pack, words);
    const again = convertPack(pack, words, { ...first.meta, stages: { "1": ["1", "2"] } });
    expect(again.meta.stages).toEqual({ "1": ["1", "2"] });
  });
});
