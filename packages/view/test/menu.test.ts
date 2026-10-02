import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureWithText } from "../src/testing";
import { bedHint, likelyOrder, makeText, placeMenu, waitingForMoney, type MenuItem } from "../src/index";

const setup = () => {
  const course = fixtureWithText();
  return { course, state: newGame(course), t: makeText(course.learnerFtl, "en") };
};

describe("place menu", () => {
  it("offers the exits, then sleep once the day's time is gone", () => {
    const { course, state, t } = setup();
    state.slot = course.world.slotsPerDay;
    const menu = placeMenu(course, state, t);
    expect(menu.map((m) => m.kind)).toEqual(["go", "sleep"]);
    expect(menu[0]).toMatchObject({ label: "Go to Noodle shop", input: { type: "goTo", place: "noodle_shop" }, place: "noodle_shop" });
    expect(menu[1]).toMatchObject({ label: "Sleep (end the day)", input: { type: "sleep" } });
  });

  it("keeps sleep off the menu while there's time and something to do, and offers it once nothing's left", () => {
    const { course, state, t } = setup();
    expect(placeMenu(course, state, t).map((m) => m.kind)).toEqual(["go"]); // "Say hello" is open at the noodle shop
    state.scenesDone.intro = 1; // the shift still needs trust: nothing is open anywhere
    expect(placeMenu(course, state, t).map((m) => m.kind)).toEqual(["go", "sleep"]);
  });

  it("offers a scene here with who it is with, and hides the cost when it's just the default slot", () => {
    const { course, state, t } = setup();
    course.world.npcs.boss = { place: "noodle_shop" };
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t)[0]).toEqual({
      kind: "talk", label: "Say hello · Cook", input: { type: "startScene", scene: "intro" }, npc: "cook", scene: "intro",
    });
  });

  it("drops the npc suffix when they're the only one here", () => {
    const { course, state, t } = setup();
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t)[0]).toMatchObject({ kind: "talk", label: "Say hello" });
  });

  it("drops the npc suffix when the scene name already names them", () => {
    const course = fixtureWithText();
    course.world.npcs.boss = { place: "noodle_shop" };
    course.learnerFtl = course.learnerFtl.replace("scene-intro = Say hello", "scene-intro = Meet Cook");
    const state = newGame(course);
    const t = makeText(course.learnerFtl, "en");
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t)[0]).toMatchObject({ kind: "talk", label: "Meet Cook" });
  });

  it("shows a yuan cost when the scene has one", () => {
    const { course, state, t } = setup();
    for (const v of Object.values(course.scenes[1].exchanges[0].variants)) v.cost = 5;
    course.world.npcs.boss = { place: "noodle_shop" };
    state.scenesDone.intro = 1;
    state.trust.cook = 1;
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t)[0]).toMatchObject({ kind: "talk", label: "Serve drinks · Cook · ¥5" });
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
    state.slot = course.world.slotsPerDay;
    const menu = placeMenu(course, state, t);
    expect(menu).toHaveLength(8);
    expect(menu.at(-1)!.kind).toBe("sleep");
  });

  it("dims talk and mentor items with a reason once the day's slots are gone, but still offers them", () => {
    const { course, state, t } = setup();
    course.world.mentor = { npc: "cook", after: "intro" };
    state.place = "noodle_shop";
    state.scenesDone.intro = 1;
    state.trust.cook = 1; // so the repeatable "shift" scene is offered here too
    state.notes.ready = ["hao"];
    state.slot = course.world.slotsPerDay;
    const menu = placeMenu(course, state, t);
    expect(menu.find((m) => m.kind === "talk")).toMatchObject({ disabled: "no time left" });
    expect(menu.find((m) => m.kind === "mentor")).toMatchObject({ disabled: "no time left" });
    // Moving around and sleeping cost no slot, so they're never disabled.
    expect(menu.find((m) => m.kind === "go")).not.toHaveProperty("disabled");
    expect(menu.find((m) => m.kind === "sleep")).not.toHaveProperty("disabled");
  });

  it("offers sleep only where there's a bed", () => {
    const { course, state, t } = setup();
    course.world.home = "street";
    state.slot = course.world.slotsPerDay;
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t).map((m) => m.kind)).not.toContain("sleep");
    state.place = "street";
    expect(placeMenu(course, state, t).at(-1)).toMatchObject({ kind: "sleep", label: "Sleep (end the day)" });
  });

  it("sleeps rough only at the start until the home scene is done", () => {
    const { course, state, t } = setup();
    course.world.home = "noodle_shop";
    course.world.homeScene = "intro";
    state.slot = course.world.slotsPerDay;
    state.place = "noodle_shop";
    expect(placeMenu(course, state, t).map((m) => m.kind)).not.toContain("sleep");
    state.place = "street";
    expect(placeMenu(course, state, t).at(-1)!.kind).toBe("sleep");
  });

  it("says where the bed is once it's time to sleep and it's elsewhere", () => {
    const { course, state } = setup();
    course.learnerFtl += "\nplace-room = Your Room\n";
    const t = makeText(course.learnerFtl, "en");
    course.world.places.room = { links: ["street"] };
    course.world.places.street.links.push("room");
    course.world.home = "room";
    state.place = "noodle_shop";
    state.scenesDone.intro = 1;
    state.trust.cook = 1;
    expect(bedHint(course, state, t)).toEqual([]);
    state.slot = course.world.slotsPerDay;
    const street = t("place-street");
    expect(bedHint(course, state, t)).toEqual([`Go to Your Room, off ${street}, to sleep.`]);
    state.place = "street";
    expect(bedHint(course, state, t)).toEqual(["Go to Your Room to sleep."]);
    state.place = "room";
    expect(bedHint(course, state, t)).toEqual([]);
  });

  it("leaves a place off the menu until the scenes that reveal it are done", () => {
    const { course, state, t } = setup();
    course.world.places.noodle_shop.after = ["intro"];
    state.slot = course.world.slotsPerDay;
    expect(placeMenu(course, state, t).map((m) => m.kind)).toEqual(["sleep"]);
    state.scenesDone.intro = 1;
    expect(placeMenu(course, state, t).map((m) => m.kind)).toEqual(["go", "sleep"]);
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

describe("likely order (a Book course's menu with nothing bright)", () => {
  it("puts a talk here first, then the way to a waiting scene, the mentor, the other ways, sleep last", () => {
    const { course, state } = setup();
    const go = (place: string): MenuItem => ({ kind: "go", label: place, input: { type: "goTo", place }, place });
    const menu: MenuItem[] = [
      { kind: "sleep", label: "sleep", input: { type: "sleep" } },
      go("elsewhere"),
      go("noodle_shop"), // "Say hello" waits there
      { kind: "mentor", label: "mentor", input: { type: "visitMentor" }, npc: "m" },
      { kind: "talk", label: "talk", input: { type: "startScene", scene: "intro" }, npc: "n", scene: "intro" },
    ];
    expect(likelyOrder(course, state, menu).map((m) => m.label)).toEqual(["talk", "noodle_shop", "mentor", "elsewhere", "sleep"]);
  });

  it("keeps the menu's order among equals", () => {
    const { course, state } = setup();
    state.scenesDone.intro = 1; // nothing waits anywhere
    const go = (place: string): MenuItem => ({ kind: "go", label: place, input: { type: "goTo", place }, place });
    expect(likelyOrder(course, state, [go("b"), go("a"), go("noodle_shop")]).map((m) => m.label)).toEqual(["b", "a", "noodle_shop"]);
  });
});
