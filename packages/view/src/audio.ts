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

/** How fast clips are said, a player preference; "slow" is the default. */
export type SpeechSpeed = "slow" | "normal" | "fast";

/** The rate for each speed, before a slow repeat halves it further (see playbackRate). */
export const SPEED_RATES: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.85, fast: 1 };

/** The speeds in order, so a settings row can cycle through them. */
export const SPEEDS: readonly SpeechSpeed[] = ["slow", "normal", "fast"];

/** What clips play at until the player says otherwise. */
export const DEFAULT_SPEED: SpeechSpeed = "slow";

/** A line marked slow plays this much slower than the speed the player chose. */
export const SLOW_RATE_FACTOR = 0.75;

/** No clip plays slower than this, however the choices add up. */
export const SLOWEST_RATE = 0.5;

/**
 * The rate a clip plays at, for a caller that already knows its base rate: the base, times 0.75 when
 * it's a slow repeat, never below 0.5. Worked out in whole hundredths and rounded once, because the
 * terminal hands this number to ffplay and mpv on a command line, and because 0.7 * 0.75 is
 * 0.5249999999999999 in floating point, which would otherwise round down to the wrong side.
 */
export function clipRate(base: number, slow = false): number {
  const hundredths = Math.round(base * 100) * (slow ? SLOW_RATE_FACTOR : 1);
  return Math.max(SLOWEST_RATE, Math.round(hundredths) / 100);
}

/** The rate a clip plays at: the player's speed, or that much slower for a line marked slow. */
export function playbackRate(speed: SpeechSpeed, slow = false): number {
  return clipRate(SPEED_RATES[speed], slow);
}

/** The next speed along, wrapping round: the settings row cycles with it. */
export function nextSpeed(speed: SpeechSpeed): SpeechSpeed {
  return SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
}
