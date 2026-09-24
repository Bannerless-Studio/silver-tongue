import { describe, expect, it } from "vitest";
import { bindSlots, messageIds, parseFtl, Renderer, termNames, type FtlSource } from "../src/fluent";

const zhTerms = `-tea = { $form ->
    [measure] 杯
   *[base] 茶
}
-three = 三
`;
const zhLines = `order = { -count }{ -item(form: "measure") }{ -item }。\n`;

const esTerms = `-tea = { $form ->
    [plural] tés
   *[base] té
}
    .gender = masc
-one = un
-three = tres
`;
const esLines = `order = { $count ->
    [one] Un { -item }, por favor.
   *[other] { -count } { -item(form: "plural") }, por favor.
}
`;

const zh = (slots: string): FtlSource[] => [["t", zhTerms], ["slots", slots], ["l", zhLines]];
const es = (slots: string): FtlSource[] => [["t", esTerms], ["slots", slots], ["l", esLines]];

describe("fluent", () => {
  it("lists terms and messages, and rejects syntax errors", () => {
    expect(termNames(zhTerms, "t")).toEqual(["tea", "three"]);
    expect(messageIds(zhLines, "l")).toEqual(["order"]);
    expect(() => parseFtl("order = {", "bad.ftl")).toThrow(/bad.ftl: Fluent syntax error/);
  });

  it("binds slots to concept terms (zh measure words)", () => {
    const r = new Renderer("zh", zh(bindSlots(zhTerms, { item: "tea", count: "three" }, zhLines, "l")));
    expect(r.render("order", { count: 3 })).toBe("三杯茶。");
  });

  it("lets each language choose its own grammar (es plurals)", () => {
    const three = new Renderer("es", es(bindSlots(esTerms, { item: "tea", count: "three" }, esLines, "l")));
    expect(three.render("order", { count: 3 })).toBe("tres tés, por favor.");
    const one = new Renderer("es", es(bindSlots(esTerms, { item: "tea", count: "one" }, esLines, "l")));
    expect(one.render("order", { count: 1 })).toBe("Un té, por favor.");
  });

  it("fails loudly on unknown concepts and missing messages", () => {
    expect(() => bindSlots(zhTerms, { item: "coffee" }, zhLines, "l")).toThrow(/no term -coffee/);
    expect(() => new Renderer("zh", [["t", zhTerms]]).render("nope")).toThrow(/missing message "nope"/);
  });

  it("rejects broken entries and duplicate names instead of dropping them", () => {
    expect(() => new Renderer("zh", [["l", "ok = fine\nbroken = { -tea\nnext = x\n"]])).toThrow(/l: Fluent syntax error/);
    expect(() => new Renderer("zh", [["l", "a = 1\na = 2\n"]])).toThrow(/l: .*a/);
    expect(() => new Renderer("zh", [["t", zhTerms], ["t2", "-tea = 水\n"]])).toThrow(/t2: .*tea/);
  });

  it("refuses a slot named like a term, and forms a term doesn't have", () => {
    expect(() => bindSlots(zhTerms, { tea: "three" }, zhLines, "l")).toThrow(/slot "tea" has the same name as the term -tea/);
    const typo = `order = { -item(form: "measur") }\n`;
    expect(() => bindSlots(zhTerms, { item: "tea" }, typo, "l")).toThrow(/l: -item \(-tea\) has no form "measur"/);
    const noForms = `order = { -three(form: "measure") }\n`;
    expect(() => bindSlots(zhTerms, {}, noForms, "l")).toThrow(/l: -three has no form "measure"/);
    const inTerms = `${zhTerms}-cup = { -tea(form: "measur") }\n`;
    expect(() => bindSlots(inTerms, {}, zhLines, "l")).toThrow(/terms.ftl: -tea has no form "measur"/);
    expect(() => bindSlots(zhTerms, {}, `order = { -tea(form: 1) }\n`, "l")).toThrow(/l: -tea has no form 1/);
  });

  it("checks forms on term attributes against the attribute's own forms", () => {
    const terms = `-tea = 茶\n    .word = { $form ->\n        [measure] 杯\n       *[base] 茶\n    }\n`;
    const ok = `order = { -item.word(form: "measure") ->\n   *[other] 杯\n}\n`;
    expect(() => bindSlots(terms, { item: "tea" }, ok, "l")).not.toThrow();
    const bad = `order = { -item.word(form: "plural") ->\n   *[x] x\n}\n`;
    expect(() => bindSlots(terms, { item: "tea" }, bad, "l")).toThrow(/l: -item.word \(-tea\) has no form "plural"/);
  });
});
