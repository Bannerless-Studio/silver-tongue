import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { makeText, placeMenu, waitingForMoney } from "../src/index";

const setup = () => {
  const course = fixtureWithText();
  return { course, state: newGame(course), t: makeText(course.learnerFtl, "en") };
};

describe("place menu", () => {
  it("offers the exits, then sleep", () => {
    const { course, state, t } = setup();
    const menu = placeMenu(course, state, t);
    expect(menu.map((m) => m.kind)).toEqual(["go", "sleep"]);
    expect(menu[0]).toMatchObject({ label: "Go to Noodle shop", input: { type: "goTo", place: "noodle_shop" }, place: "noodle_shop" });
    expect(menu[1]).toMatchObject({ label: "Sleep (end the day)", input: { type: "sleep" } });
  });

  it("offers a scene here with who it is with and its slot cost", () => {
    const { course, state, t } = setup();
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t)[0]).toEqual({
      kind: "talk", label: "Talk to Cook: Say hello · 1 slot", input: { type: "startScene", scene: "intro" }, npc: "cook", scene: "intro",
    });
  });

  it("offers the mentor only when a note is waiting", () => {
    const { course, state, t } = setup();
    course.world.mentor = { npc: "cook", after: "intro" };
    state.place = "noodle_shop";
    state.scenesDone.intro = 1;
    expect(placeMenu(course, state, t).some((m) => m.kind === "mentor")).toBe(false);
    state.notes.ready = ["hao"];
    expect(placeMenu(course, state, t).find((m) => m.kind === "mentor")).toMatchObject({ npc: "cook", input: { type: "visitMentor" } });
  });

  it("keeps at most seven items before sleep", () => {
    const { course, state, t } = setup();
    for (let i = 0; i < 9; i++) {
      course.world.places[`p${i}`] = { links: ["street"] };
      course.world.places.street.links.push(`p${i}`);
    }
    const menu = placeMenu(course, state, t);
    expect(menu).toHaveLength(8);
    expect(menu.at(-1)!.kind).toBe("sleep");
  });

  it("names the scenes here that wait only for money", () => {
    const { course, state, t } = setup();
    for (const v of Object.values(course.scenes[1].exchanges[0].variants)) v.cost = 100;
    state.place = "noodle_shop";
    state.scenesDone.intro = 1;
    state.trust.cook = 1;
    expect(waitingForMoney(course, state, t)).toEqual(["Cook: Serve drinks · needs ¥100"]);
  });
});
