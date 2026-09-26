import type { AudioOut, Speech } from "@silver-tongue/view";

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
}

const BEAT_MS = 300;
const SLOW_RATE = 0.8;
/** Clips failing to load one after another: the clips aren't there (a page saved without its audio folder). */
const FAILS_TO_GIVE_UP = 3;

/**
 * Plays clips through one audio element, in order with a beat between them; a slow line plays at
 * 0.8 speed. A clip that won't load is skipped, and a play() the browser refuses (no key pressed
 * yet) is ignored: the text is on screen anyway.
 */
export function createWebAudio(deps: WebAudioDeps): AudioOut {
  const el = deps.audio;
  let queue: { clip: string; slow: boolean }[] = [];
  let timer: { cancel(): void } | undefined;
  let run = 0; // each play() or stop() starts a new run; events from an older one do nothing
  let fails = 0;

  const next = (mine: number) => {
    timer = undefined;
    if (mine !== run || !el) return;
    const item = queue.shift();
    if (!item) return;
    const done = () => {
      if (mine !== run) return;
      if (queue.length) timer = deps.wait(BEAT_MS, () => next(mine));
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
    el.defaultPlaybackRate = el.playbackRate = item.slow ? SLOW_RATE : 1;
    // Refused (no key pressed yet): nothing will end, so go on as if it had.
    el.play().catch(() => done());
  };

  const stop = () => {
    run++;
    queue = [];
    timer?.cancel();
    timer = undefined;
    el?.pause();
  };

  return {
    get available() {
      return !!el && fails < FAILS_TO_GIVE_UP;
    },
    play(lines: Speech[]) {
      stop();
      queue = lines.flatMap((l) => l.clips.map((clip) => ({ clip, slow: !!l.slow })));
      next(run);
    },
    stop,
  };
}
