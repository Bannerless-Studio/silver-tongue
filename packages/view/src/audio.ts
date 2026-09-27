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

/** How fast clips are said, a player preference; "slow" is the default. */
export type SpeechSpeed = "slow" | "normal" | "fast";

/** The rate for each speed, before a slow repeat halves it further (see playbackRate). */
export const SPEEDS: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.85, fast: 1 };

/**
 * The rate to actually play a clip at: the chosen speed, times 0.75 when it's a slow repeat (the
 * NPC saying itself again after a miss), rounded to 2 places and never below 0.5.
 */
export function playbackRate(speed: SpeechSpeed, slow = false): number {
  const raw = SPEEDS[speed] * (slow ? 0.75 : 1);
  return Math.max(0.5, Math.round(raw * 100) / 100);
}
