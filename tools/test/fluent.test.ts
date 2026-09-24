import { describe, expect, it } from "vitest";
import { bindSlots, messageIds, parseFtl, Renderer, termNames } from "../src/fluent";

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

describe("fluent", () => {
  it("lists terms and messages, and rejects syntax errors", () => {
    expect(termNames(zhTerms, "t")).toEqual(["tea", "three"]);
    expect(messageIds(zhLines, "l")).toEqual(["order"]);
    expect(() => parseFtl("order = {", "bad.ftl")).toThrow(/bad.ftl: Fluent syntax error/);
  });

  it("binds slots to concept terms (zh measure words)", () => {
    const r = new Renderer("zh", [zhTerms, bindSlots(zhTerms, { item: "tea", count: "three" }), zhLines]);
    expect(r.render("order", { count: 3 })).toBe("三杯茶。");
  });

  it("lets each language choose its own grammar (es plurals)", () => {
    const three = new Renderer("es", [esTerms, bindSlots(esTerms, { item: "tea", count: "three" }), esLines]);
    expect(three.render("order", { count: 3 })).toBe("tres tés, por favor.");
    const one = new Renderer("es", [esTerms, bindSlots(esTerms, { item: "tea", count: "one" }), esLines]);
    expect(one.render("order", { count: 1 })).toBe("Un té, por favor.");
  });

  it("fails loudly on unknown concepts and missing messages", () => {
    expect(() => bindSlots(zhTerms, { item: "coffee" })).toThrow(/no term -coffee/);
    expect(() => new Renderer("zh", [zhTerms]).render("nope")).toThrow(/missing message "nope"/);
  });
});
