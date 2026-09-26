/** What one line says: its clips in order, and whether to say them slowly. */
export interface Speech {
  clips: string[];
  slow?: boolean;
}

/** Sound out, as each front end provides it. The app decides what to say; this only says it. */
export interface AudioOut {
  /** Whether sound can play at all here (a player program was found, the browser allows it). */
  readonly available: boolean;
  /** A clip is playing or queued behind one. A front end that does not say leaves it unset. */
  readonly busy?: boolean;
  /** Stops anything playing, then says these lines in order, with a short beat between clips. */
  play(lines: Speech[]): void;
  stop(): void;
}

/** How fast clips play, slowest first: a beginner wants time to copy what they hear. */
export const SPEEDS = ["slow", "normal", "fast"] as const;
export type SpeechSpeed = (typeof SPEEDS)[number];
export const SPEED_RATES: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.85, fast: 1 };
/** A line said slowly is this much slower than the speed the player chose… */
export const SLOW_RATE_FACTOR = 0.75;
/** …and never slower than this. */
export const SLOWEST_RATE = 0.5;

/** The rate a clip plays at: the player's speed, or that much slower for a line marked slow. */
export function playbackRate(speed: SpeechSpeed, slow = false): number {
  return Math.max(SLOWEST_RATE, SPEED_RATES[speed] * (slow ? SLOW_RATE_FACTOR : 1));
}

/** The next speed along, wrapping round: the settings row cycles with it. */
export function nextSpeed(speed: SpeechSpeed): SpeechSpeed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}
