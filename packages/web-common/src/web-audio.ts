import { clipRate, type AudioOut, type Speech } from "@silver-tongue/view";

/** The part of HTMLAudioElement this uses. */
export interface AudioLike {
  src: string;
  playbackRate: number;
  /** what loading a new src resets playbackRate to */
  defaultPlaybackRate: number;
  play(): Promise<void>;
  pause(): void;
  // Loose handler types, so a real HTMLAudioElement (whose handlers take an event) fits.
  onended: ((...args: never[]) => unknown) | null;
  onerror: ((...args: never[]) => unknown) | null;
}

export interface WebAudioDeps {
  /** where the clips are, relative to the page: "audio/" */
  base: string;
  /** undefined where the browser has no Audio */
  audio: AudioLike | undefined;
  wait: (ms: number, cb: () => void) => { cancel(): void };
  /** how fast to play, asked for each clip so a change in settings takes at once */
  rate?: () => number;
}

const BEAT_MS = 300;
/** Clips failing to load one after another: the clips aren't there (a page saved without its audio folder). */
const FAILS_TO_GIVE_UP = 3;
/** A backstop for a load that never reports an end, not a length: the longest clip in a course is
 *  3.6s and no page plays below clipRate's 0.5, so 7.3s is the worst any clip can take and this is
 *  under three times that. It is armed per clip, so a stalled scene is back in about 40s, not 20s. */
const STALL_BACKSTOP_MS = 20_000;

/**
 * Plays clips through one audio element, in order with a beat between them, at the rate the page asks
 * for (0.75× that for a slow line). A clip that won't load is skipped, and a play() the browser
 * refuses (no key pressed yet) is ignored: the text is on screen anyway.
 */
export function createWebAudio(deps: WebAudioDeps): AudioOut {
  const el = deps.audio;
  let queue: { clip: string; slow: boolean }[] = [];
  let timer: { cancel(): void } | undefined;
  // Its own handle, never `timer`: the beat only exists once a clip has ended, the backstop only
  // while one is playing, and that is by accident, not by design.
  let stall: { cancel(): void } | undefined;
  let run = 0; // each play() or stop() starts a new run; events from an older one do nothing
  let fails = 0;
  let speaking = false;

  const next = (mine: number) => {
    timer = undefined;
    if (mine !== run || !el) return;
    const item = queue.shift();
    if (!item) return;
    speaking = true;
    // The backstop can end a clip whose load is still going, so the event that arrives after it must
    // not arm a second beat: that would start the clip after next over the one still speaking.
    let ended = false;
    const done = () => {
      if (mine !== run || ended) return;
      ended = true;
      // Defensive, and kept this side of the guard: an event outlives its run only when it arrives
      // after stop(), and by then there is no backstop left to take away.
      stall?.cancel();
      stall = undefined;
      if (queue.length) {
        timer = deps.wait(BEAT_MS, () => next(mine));
        return;
      }
      speaking = false;
    };
    el.onended = () => {
      fails = 0;
      done();
    };
    el.onerror = () => {
      fails++;
      done();
    };
    el.src = `${deps.base}${item.clip}.mp3`;
    el.defaultPlaybackRate = el.playbackRate = clipRate(deps.rate?.() ?? 1, item.slow);
    // A load that stalls fires no event at all, so without this nothing ever ends the clip.
    stall = deps.wait(STALL_BACKSTOP_MS, done);
    // Refused (no key pressed yet): nothing will end, so go on as if it had.
    el.play().catch(() => done());
  };

  const stop = () => {
    run++;
    queue = [];
    speaking = false;
    timer?.cancel();
    timer = undefined;
    stall?.cancel();
    stall = undefined;
    el?.pause();
  };

  return {
    get available() {
      return !!el && fails < FAILS_TO_GIVE_UP;
    },
    get busy() {
      return speaking;
    },
    play(lines: Speech[]) {
      stop();
      queue = lines.flatMap((l) => l.clips.map((clip) => ({ clip, slow: !!l.slow })));
      next(run);
    },
    stop,
  };
}
