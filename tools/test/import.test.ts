import { describe, expect, it } from "vitest";
import { convertPack, ftlValue, packProblems } from "../src/import-vocab-pack";

const pack = { key: "zh", name: "Mandarin", tts: "zh-CN", ttsRate: 0.85, levels: [{ id: "1", label: "HSK 1" }, { id: "2", label: "HSK 2" }], typing: null, spaced: false };
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
      tts: "zh-CN",
      ttsRate: 0.85,
      levels: ["1", "2"],
      stages: { "1": ["1"], "2": ["2"] },
      typing: null,
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

  it("keeps alternatives, part of speech, typing rules and an explicit locale", () => {
    const typing = { caseSensitive: false, accents: "lenient" };
    const es = { key: "es", name: "Spanish", tts: "es-ES", langTag: "es-419", levels: [{ id: "A1", label: "A1" }], typing, spaced: true };
    const r = convertPack(es, [{ id: "w1", w: "hola", en: "hello", lv: "A1", alt: ["buenas"], pos: "intj" }]);
    expect(r.meta).toMatchObject({ locale: "es-419", tts: "es-ES", typing, spaced: true });
    expect(r.meta).not.toHaveProperty("ttsRate");
    expect(r.words).toEqual([{ id: "w1", w: "hola", lv: "A1", alt: ["buenas"], pos: "intj" }]);
  });

  it("reports every bad word and stale stage instead of writing a broken pack", () => {
    const bad = [
      { id: "w1", w: "茶", en: "tea", lv: "1" },
      { id: "w1", w: "水", en: "water", lv: "1" },
      { id: "1x", w: "一", en: "one", lv: "1" },
      { id: "w2", w: "", en: "empty", lv: "1" },
      { id: "w3", w: "山", lv: "9" },
    ] as never[];
    expect(packProblems(pack, bad, { ...convertPack(pack, words).meta, stages: { "1": ["1", "5"] } })).toEqual([
      "word 1 (w1): duplicate id",
      "word 2 (1x): id must match /^[a-zA-Z][a-zA-Z0-9_-]*$/",
      "word 3 (w2): missing w",
      "word 4 (w3): missing en",
      'word 4 (w3): level "9" is not in the pack\'s levels',
      'stage 1: level "5" is not in the pack\'s levels',
    ]);
    expect(() => convertPack(pack, bad)).toThrow(/can't be imported/);
  });
});
