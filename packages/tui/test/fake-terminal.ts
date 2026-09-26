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

  cursor: { row: number; col: number } | undefined;
  write(lines: StyledLine[], cursor?: { row: number; col: number }): void {
    this.frames.push(lines);
    this.cursor = cursor;
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
  /** Types text character by character, as a keyboard would (names keep their case in `text`). */
  type(text: string): void {
    for (const ch of text) this.handler({ name: ch.toLowerCase(), text: ch });
  }
  /** The last frame as plain text lines. */
  screen(): string[] {
    return (this.frames.at(-1) ?? []).map(plain);
  }
}

export { fixtureWithText, spacedWithText } from "@silver-tongue/view/testing";
