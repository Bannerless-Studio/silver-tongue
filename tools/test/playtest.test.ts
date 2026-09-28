import { describe, expect, it } from "vitest";
import { newGame } from "@silver-tongue/core";
import { fixtureCourse } from "@silver-tongue/core/testing";
import { makeText, placeMenu } from "@silver-tongue/view";
import {
  computeWalkPath,
  menuIndexFor,
  parseKeyScript,
  parseKeyToken,
  parsePlaytestArgs,
  resolvePlaceId,
  resolveSceneId,
} from "../src/playtest";

describe("parseKeyToken", () => {
  it("presses a bare character as itself, lower-cased", () => {
    expect(parseKeyToken("1")).toEqual({ op: "press", name: "1" });
    expect(parseKeyToken("w")).toEqual({ op: "press", name: "w" });
    expect(parseKeyToken("W")).toEqual({ op: "press", name: "w" });
  });

  it("maps named keys onto Key.name", () => {
    expect(parseKeyToken("enter")).toEqual({ op: "press", name: "return" });
    expect(parseKeyToken("Return")).toEqual({ op: "press", name: "return" });
    expect(parseKeyToken("esc")).toEqual({ op: "press", name: "escape" });
    expect(parseKeyToken("escape")).toEqual({ op: "press", name: "escape" });
    expect(parseKeyToken("backspace")).toEqual({ op: "press", name: "backspace" });
    expect(parseKeyToken("up")).toEqual({ op: "press", name: "up" });
    expect(parseKeyToken("ctrl-c")).toEqual({ op: "press", name: "ctrl-c" });
  });

  it("types a string, keeping its case, with type:", () => {
    expect(parseKeyToken("type:Ishmum")).toEqual({ op: "type", text: "Ishmum" });
    expect(parseKeyToken("type:")).toEqual({ op: "type", text: "" });
  });

  it("rejects an unnamed multi-character token", () => {
    expect(() => parseKeyToken("xyz")).toThrow(/unknown key token/);
  });
});

describe("parseKeyScript", () => {
  it("splits an inline comma-separated script", () => {
    expect(parseKeyScript("1,1,w,2,esc")).toEqual([
      { op: "press", name: "1" },
      { op: "press", name: "1" },
      { op: "press", name: "w" },
      { op: "press", name: "2" },
      { op: "press", name: "escape" },
    ]);
  });

  it("splits a one-key-per-line file, dropping blanks and # comments", () => {
    const source = "1\n\n# go to the noodle shop\n1\nw  # look up a word\n\ntype:Ishmum\nenter\n";
    expect(parseKeyScript(source)).toEqual([
      { op: "press", name: "1" },
      { op: "press", name: "1" },
      { op: "press", name: "w" },
      { op: "type", text: "Ishmum" },
      { op: "press", name: "return" },
    ]);
  });

  it("allows commas within a script file too", () => {
    expect(parseKeyScript("1, 1\nw, 2")).toEqual([
      { op: "press", name: "1" },
      { op: "press", name: "1" },
      { op: "press", name: "w" },
      { op: "press", name: "2" },
    ]);
  });
});

describe("resolvePlaceId / resolveSceneId", () => {
  const course = fixtureCourse();
  const t = makeText(course.learnerFtl, course.learner);

  it("resolves a place by its id", () => {
    expect(resolvePlaceId(course, t, "noodle_shop")).toBe("noodle_shop");
  });

  it("resolves a place by its rendered label, case-insensitively", () => {
    // the fixture course has no learner Fluent source, so a missing message renders as its own id
    expect(resolvePlaceId(course, t, "PLACE-noodle_shop")).toBe("noodle_shop");
  });

  it("throws, listing the places it has, for an unknown place", () => {
    expect(() => resolvePlaceId(course, t, "atlantis")).toThrow(/no place "atlantis".*street.*noodle_shop/s);
  });

  it("resolves a scene by its id or rendered label", () => {
    expect(resolveSceneId(course, t, "intro")).toBe("intro");
    expect(resolveSceneId(course, t, "SCENE-intro")).toBe("intro");
  });

  it("throws for an unknown scene", () => {
    expect(() => resolveSceneId(course, t, "nope")).toThrow(/no scene "nope"/);
  });
});

describe("menuIndexFor", () => {
  const course = fixtureCourse();
  const t = makeText(course.learnerFtl, course.learner);

  it("finds a go/talk/sleep item by place or scene id against a sample rendered menu", () => {
    const atStreet = placeMenu(course, newGame(course), t);
    expect(menuIndexFor(atStreet, { kind: "go", place: "noodle_shop" })).toBe(0);
    expect(menuIndexFor(atStreet, { kind: "sleep" })).toBe(-1); // the day has only begun
    const tired = placeMenu(course, { ...newGame(course), slot: course.world.slotsPerDay }, t);
    expect(menuIndexFor(tired, { kind: "sleep" })).toBe(tired.length - 1);

    const atShop = placeMenu(course, { ...newGame(course), place: "noodle_shop" }, t);
    expect(menuIndexFor(atShop, { kind: "talk", scene: "intro" })).toBe(0);
    expect(menuIndexFor(atShop, { kind: "go", place: "street" })).toBe(1);
  });

  it("returns -1 when the wanted item isn't in the menu", () => {
    const atStreet = placeMenu(course, newGame(course), t);
    expect(menuIndexFor(atStreet, { kind: "talk", scene: "intro" })).toBe(-1);
    expect(menuIndexFor(atStreet, { kind: "go", place: "atlantis" })).toBe(-1);
  });
});

describe("computeWalkPath", () => {
  const course = fixtureCourse();

  it("returns no hops when already there", () => {
    expect(computeWalkPath(course, "street", "street")).toEqual([]);
  });

  it("returns the one-hop path between the fixture's two linked places", () => {
    expect(computeWalkPath(course, "street", "noodle_shop")).toEqual(["noodle_shop"]);
    expect(computeWalkPath(course, "noodle_shop", "street")).toEqual(["street"]);
  });

  it("walks multiple hops along a longer chain", () => {
    const chained = structuredClone(course);
    chained.world.places = { street: { links: ["noodle_shop"] }, noodle_shop: { links: ["street", "market"] }, market: { links: ["noodle_shop"] } };
    expect(computeWalkPath(chained, "street", "market")).toEqual(["noodle_shop", "market"]);
  });

  it("throws when no path exists", () => {
    const island = structuredClone(course);
    island.world.places = { ...island.world.places, island: { links: [] } };
    expect(() => computeWalkPath(island, "street", "island")).toThrow(/no path from "street" to "island"/);
  });
});

describe("parsePlaytestArgs", () => {
  it("defaults run to \"run\", cols/rows to 80x24, seed to 1", () => {
    const args = parsePlaytestArgs([]);
    expect(args.run).toBe("run");
    expect(args.resume).toBeUndefined();
    expect(args.cols).toBe(80);
    expect(args.rows).toBe(24);
    expect(args.seed).toBe(1);
    expect(args.realAudio).toBe(false);
  });

  it("--resume sets the run id and is required to already have a save", () => {
    const args = parsePlaytestArgs(["--resume", "scene-1", "--keys", "1"]);
    expect(args.run).toBe("scene-1");
    expect(args.resume).toBe("scene-1");
  });

  it("reads --cols, --rows, --seed, --auto and --real-audio", () => {
    const args = parsePlaytestArgs(["--cols", "100", "--rows", "30", "--seed", "42", "--auto", "5", "--real-audio"]);
    expect(args.cols).toBe(100);
    expect(args.rows).toBe(30);
    expect(args.seed).toBe(42);
    expect(args.auto).toBe(5);
    expect(args.realAudio).toBe(true);
  });

  it("defaults wallClock to false and reads --wall-clock", () => {
    expect(parsePlaytestArgs([]).wallClock).toBe(false);
    expect(parsePlaytestArgs(["--wall-clock"]).wallClock).toBe(true);
  });

  it("rejects --run and --resume names outside [A-Za-z0-9_-]", () => {
    expect(() => parsePlaytestArgs(["--run", "../evil"])).toThrow(/--run/);
    expect(() => parsePlaytestArgs(["--run", "a b"])).toThrow(/--run/);
    expect(() => parsePlaytestArgs(["--resume", "a/b"])).toThrow(/--resume/);
    expect(parsePlaytestArgs(["--run", "scene_1-ok"]).run).toBe("scene_1-ok");
  });

  it("reads --goto, --start, --play and --sleep", () => {
    expect(parsePlaytestArgs(["--goto", "Market Street"]).goto).toBe("Market Street");
    expect(parsePlaytestArgs(["--start", "street-hello"]).start).toBe("street-hello");
    expect(parsePlaytestArgs(["--play", "street-hello"]).play).toBe("street-hello");
    expect(parsePlaytestArgs(["--sleep"]).sleep).toBe(true);
    expect(parsePlaytestArgs([]).sleep).toBe(false);
  });

  it("rejects passing both --start and --play", () => {
    expect(() => parsePlaytestArgs(["--start", "a", "--play", "b"])).toThrow(/only one of --start or --play/);
  });
});
