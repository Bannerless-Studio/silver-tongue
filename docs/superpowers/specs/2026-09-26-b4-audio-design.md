# B4: audio

Status: approved in conversation 2026-09-26.

## Goal

Every Chinese line and word can be heard. NPC lines play as they appear, your reply plays after you
choose it, and you can replay a line or hear a single word. Audio never blocks the game: with no
sound available, the text still shows and the bottom border says so.

## Decisions (from the user)

- **Voices:** generated with edge-tts, for now.
- **Clips:** generated locally and committed to the repo; CI never calls a text-to-speech service.
- **Voices per person:** each character has their own voice, and your replies have a voice of their own.
- **Your name:** a line containing your name plays as two clips, with a short beat where the name goes.
- **Playback:** lines play automatically. `[r]` replays the last line, `[m]` toggles sound (kept in
  the save), and `[p]` in word help plays the word.

This replaces the main design's "audio first, then text": text shows at once and the clip plays
alongside it.

## Part 1: generating and storing clips

### Voices

`content/languages/zh/voices.json`:

```json
{
  "engine": "edge-tts",
  "player": "zh-CN-YunxiNeural",
  "words": "zh-CN-XiaoxiaoNeural",
  "npcs": {
    "wang": "zh-CN-YunyangNeural",
    "cook": "zh-CN-XiaoxiaoNeural",
    "landlord": "zh-CN-YunjianNeural",
    "foreman": "zh-CN-YunjianNeural",
    "dispatcher": "zh-CN-XiaoyiNeural",
    "doctor": "zh-CN-YunyangNeural",
    "teacher": "zh-CN-XiaoxiaoNeural",
    "traveller": "zh-CN-XiaoyiNeural",
    "shopkeeper": "zh-CN-XiaoxiaoNeural",
    "teaboss": "zh-CN-YunyangNeural",
    "neighbour": "zh-CN-XiaoyiNeural",
    "classmate": "zh-CN-YunxiaNeural",
    "driver": "zh-CN-YunjianNeural"
  }
}
```

- The player voice is used by no NPC.
- No two NPCs at the same place share a voice.
- The build checks both rules, and that every NPC in `world.json` has a voice.

### What gets a clip

| Line | Voice |
|---|---|
| An NPC line and its rephrase | the scene's NPC |
| A reply, and each written wrong reply (`alt`) | the player |
| A reaction (`不是。`, `几杯？`) | every NPC who can say it, i.e. every NPC with a scene; one clip each |
| A word (the notebook, word help) | the words voice |

### Clip ids and files

- **Clip id:** the first 16 hex characters of `sha1("<voice>|<text>")`.
- **File:** `content/audio/zh/<id>.mp3`, mono MP3 at 24 kHz and 48 kbit/s (edge-tts's format).
- **Trimming (0.12.2):** edge-tts pads each clip with about a second of silence, which made long
  gaps between clips. `npm run audio` now trims both ends with ffmpeg (keeping 0.05 s before and
  0.1 s after), so making clips needs ffmpeg as well as edge-tts. `npm run audio -- --retrim` trims
  clips made before this.
- **Your name:** a line whose rendered text contains the player mark (U+E000) is split at the mark
  into the part before and the part after. Each non-empty part is spoken as its own clip, and the
  line's clip list holds both in order.

### `npm run audio` (tools/src/audio.ts)

1. Build the course in memory (the same `buildCourse`).
2. List every needed clip `{ id, voice, text }`.
3. For each clip whose file is missing, run `edge-tts --voice <voice> --text <text> --write-media <file>`.
   Runs are sequential, with a retry on failure. edge-tts is installed with `pipx install edge-tts`;
   if it isn't found, the script says so and exits.
4. Delete every `.mp3` in `content/audio/zh/` that nothing needs.
5. Print counts: needed, made, deleted.

Clips are committed. The expected total is about 810 clips, roughly 8–10 MB.

### The build

- Every rendered line in `course.json` gets `audio: string[]` (clip ids). NPC lines use the NPC's
  voice, replies and alts the player's.
- Every word gets `audio: string[]`.
- Reactions: `course.reactionAudio: Record<reactionId, Record<npcId, string[]>>`.
- `RenderedLine.audio` changes from `string` to `string[]`. Nothing reads it yet.
- `Word.audio?: string[]` and `Course.reactionAudio?` are added.
- **`checks.audio` is turned on** in `content/courses/zh-china-en.json`. The checker then reports:
  - any line, word or reaction without clip ids;
  - any clip id whose file is missing in `content/audio/zh/`;
  - voice-map errors.
- The existing `audio` check in `check.ts`, which requires `l.audio` on every line, is updated to
  the new shape.

## Part 2: playback

### Core

- `GameState.sound?: boolean`. Missing means on, so old saves load unchanged; `parseSave` accepts a
  boolean or nothing.
- New input `{ type: "setSound"; on: boolean }` and new event `{ type: "soundSet"; on: boolean }`.
  `Input` and `GameEvent` only grow.
- It is accepted anywhere, including mid-scene, and uses no slot.

### The shared app (packages/tui)

`AppOptions.audio?: AudioOut`:

```ts
export interface AudioOut {
  /** Whether sound can play at all here (a player program was found, the browser allows it). */
  readonly available: boolean;
  /** Stops anything playing, then plays these clips in order with a short beat between them. */
  play(clips: string[], opts?: { slow?: boolean }): void;
  stop(): void;
}
```

- **What plays:**
  - on `lineSpoken` and `lineRephrased`, the line's clips (`slow` when the event says so);
  - after a reply, the chosen line's clips: the option picked in pick mode, or the right reply
    when tiles match;
  - on a reaction, the clip for that reaction in the scene NPC's voice.
- **Keys:**
  - `[r]` replays the last clips played;
  - `[m]` sends `setSound` with the opposite of the current setting;
  - `[p]` in word help plays the highlighted word.
  - The help line and the bottom border list them.
- **Sound off** (`state.sound === false`): nothing plays, and `[r]` and `[p]` do nothing.
- **Bottom border:**
  - `♪` while sound is on and available;
  - `♪ off` when turned off;
  - `no audio` when `available` is false, or when the line being shown has no clips.
- **Wording:** every new string goes in `ui.ftl` and `UI_KEYS`.
- **Without `audio`** (tests, or a backend without sound): as if `available` were false.

### Terminal (packages/tui-node)

- The bundle copies `content/audio/zh/*.mp3` next to `course.json`, so the npm package carries
  them.
- `NodeAudio` looks for the first player on `PATH`, each run with its quiet flags:
  1. `ffplay -nodisp -autoexit -loglevel quiet`
  2. `mpv --no-video --really-quiet`
  3. `mpg123 -q`
  4. `afplay`
- It plays clips one after another by spawning the player per clip, with a 300 ms beat between
  them. `stop()` kills the running process and cancels the queue.
- `slow` is ignored here: the same clip plays at normal speed.
- A spawn error marks audio unavailable for the rest of the session. It never throws into the game.

### Browser (packages/tui-web)

- The web build copies the clips to `dist/audio/`.
- `WebAudio` uses one `HTMLAudioElement` with `src = "audio/<id>.mp3"`, plays clips in sequence with
  a 300 ms beat, and uses `playbackRate = 0.8` for `slow`.
- A rejected `play()`, for example before the first key press, is ignored; the text is already on
  screen.
- The on-screen key bar gains `r` and `m`.

## Testing

- **Build:**
  - clip ids are stable and depend on voice + text;
  - a name line gets two clips;
  - a reaction gets one clip per NPC;
  - `checks.audio` fails on a missing file and passes when all exist (temp content dir with dummy
    files);
  - the voice-map rules are enforced.
- **Audio script:** the planning function (needed / missing / unused) is unit-tested with a fake file
  list. The edge-tts call is not run in tests.
- **Core:** `setSound` round-trips through save and load, and an old save without `sound` loads
  as on.
- **App** (fake `AudioOut` recording calls):
  - clips play on line, rephrase (slow), reply and reaction;
  - `[r]` replays and `[m]` toggles and silences;
  - `[p]` plays the word;
  - the border shows `♪`, `♪ off` or `no audio`.
- **Node audio:** player detection over a fake `PATH` lookup, the spawn order with a fake spawner,
  and `stop()` killing the process.
- **Web audio:** a stubbed `Audio` element for sequence, slow rate and a rejected play.
- **Play-test:** `npm run audio` for real, then listen in the terminal (ffplay) and in the browser;
  spot-check tones on 一 and 不 lines.
- **Review and release:** one opus review of the whole branch, every finding fixed, minors included,
  then release 0.12.0.

## Not in this slice

- A native-speaker check of the tones (the main design's open question stays open).
- Slow-speed clips generated separately.
- Other TTS providers; switching later means changing `voices.json` `engine` and the script.
