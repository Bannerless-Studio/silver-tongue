import { describe, expect, it } from "vitest";
import { joinReadings } from "../src/index";

describe("readings run together", () => {
  const liaison = { before: "aeiouwy", finals: { k: "g", p: "b", t: "s", l: "r", ng: "ng" } };

  it("joins as they are with no liaison", () => {
    expect(joinReadings(["chaek", "ieyo"])).toBe("chaekieyo");
  });

  it("carries a final over to a part starting with one of before, longest final first", () => {
    expect(joinReadings(["chaek", "ieyo"], liaison)).toBe("chaegieyo");
    expect(joinReadings(["gimbap", "eul"], liaison)).toBe("gimbabeul");
    expect(joinReadings(["bang", "ieyo"], liaison)).toBe("bangieyo");
    expect(joinReadings(["sam", "cheon"], liaison)).toBe("samcheon");
    expect(joinReadings(["boksajip", "eseo"], liaison)).toBe("boksajibeseo");
  });

  it("leaves a part with no reading, and the last part, as they are", () => {
    expect(joinReadings(["", "ieyo"], liaison)).toBe("ieyo");
    expect(joinReadings(["chaek"], liaison)).toBe("chaek");
  });
});
