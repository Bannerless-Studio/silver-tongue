/** What one line says: its clips in order, and whether to say them slowly. */
export interface Speech {
  clips: string[];
  slow?: boolean;
}

/** Sound out, as each front end provides it. The app decides what to say; this only says it. */
export interface AudioOut {
  /** Whether sound can play at all here (a player program was found, the browser allows it). */
  readonly available: boolean;
  /** Stops anything playing, then says these lines in order, with a short beat between clips. */
  play(lines: Speech[]): void;
  stop(): void;
}
