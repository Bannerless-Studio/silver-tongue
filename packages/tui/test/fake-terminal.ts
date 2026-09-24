import { readFileSync } from "node:fs";
import { fixtureCourse } from "@silver-tongue/core/testing";
import type { Course } from "@silver-tongue/core";
import { plain, type Key, type StyledLine, type Terminal } from "../src/terminal";

export class FakeTerminal implements Terminal {
  frames: StyledLine[][] = [];
  closed = false;
  private handler: (k: Key) => void = () => {};
  private resized: () => void = () => {};

  constructor(
    public cols = 64,
    public rows = 20,
  ) {}

  write(lines: StyledLine[]): void {
    this.frames.push(lines);
  }
  onKey(handler: (k: Key) => void): void {
    this.handler = handler;
  }
  onResize(handler: () => void): void {
    this.resized = handler;
  }
  /** Changes the size and tells the app, like a window resize. */
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.resized();
  }
  size() {
    return { cols: this.cols, rows: this.rows };
  }
  close(): void {
    this.closed = true;
  }
  press(...names: string[]): void {
    for (const name of names) this.handler({ name });
  }
  /** The last frame as plain text lines. */
  screen(): string[] {
    return (this.frames.at(-1) ?? []).map(plain);
  }
}

const NARRATION = `
place-street = The street
place-street-desc = Bikes and steam.
place-noodle_shop = Noodle shop
place-noodle_shop-desc = Steam everywhere. The cook waves you over.
npc-cook = Cook
scene-intro = Say hello
scene-shift = Serve drinks
`;

/** The fixture course with the real English UI text. */
export function fixtureWithText(): Course {
  const ui = readFileSync(new URL("../../../content/learner/en/ui.ftl", import.meta.url), "utf8");
  return { ...fixtureCourse(), learnerFtl: ui + NARRATION };
}
