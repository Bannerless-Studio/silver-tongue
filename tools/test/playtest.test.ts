import { describe, expect, it } from "vitest";
import { parseKeyScript, parseKeyToken, parsePlaytestArgs } from "../src/playtest";

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
});
