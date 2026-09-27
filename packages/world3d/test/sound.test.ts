// Music, ambience and effects (audio.ts), DOM-free: the pure choices the SoundMixer plays: the
// file format by canPlayType, the music bed for the phase / daylight / space, the ambient loops by
// distance to the real town's water, daylight and zone, the footstep surface from the real walk
// grid and decks, the stride clock, the event effects; the vendored manifest; the prefs.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AFTERNOON_AT,
  AMBIENT_BEDS,
  AMBIENT_LIGHT_CAPS,
  ambientFor,
  CROSSFADE_S,
  distanceToPath,
  dbToGain,
  EVENING_AT,
  fileFor,
  footstep,
  musicFor,
  MUSIC_BUS_CAP,
  MUSIC_FADE_IN_S,
  SoundMixer,
  nearness,
  PIER_RANGE_M,
  pickFormat,
  sfxForEvent,
  StrideClock,
  surfaceFor,
  TREE_RANGE_M,
  waterDistance,
  WATER_RANGE_M,
  type SoundEntry,
  type MixerContext,
} from "../src/audio";
import { deckAt, gridClass, LAYOUT } from "../src/layout";
import { DEFAULT_PREFS, loadPrefs, OLD_DEFAULT_MUSIC, PREFS_KEY, savePrefs } from "../src/prefs";

const town = LAYOUT.town;
const MANIFEST = fileURLToPath(new URL("../assets/audio/manifest.json", import.meta.url));
const manifest: SoundEntry[] = JSON.parse(readFileSync(MANIFEST, "utf8"));

type FakeParam = {
  value: number;
  ramps: number[];
  setTargetAtTime(value: number): void;
  cancelScheduledValues(): void;
  setValueAtTime(value: number): void;
  linearRampToValueAtTime(value: number): void;
};
type FakeNode = { connections: unknown[]; connect(destination: unknown): unknown };

function audioHarness() {
  const param = (value = 0): FakeParam => {
    const p: FakeParam = {
      value,
      ramps: [],
      setTargetAtTime(next) { p.value = next; },
      cancelScheduledValues() {},
      setValueAtTime(next) { p.value = next; },
      linearRampToValueAtTime(next) { p.value = next; p.ramps.push(next); },
    };
    return p;
  };
  const node = (): FakeNode => {
    const n: FakeNode = { connections: [], connect(destination) { n.connections.push(destination); return destination; } };
    return n;
  };
  const gains: Array<FakeNode & { gain: FakeParam }> = [];
  const compressors: Array<FakeNode & { threshold: FakeParam; knee: FakeParam; ratio: FakeParam; attack: FakeParam; release: FakeParam }> = [];
  const sources: Array<FakeNode & { loop: boolean; starts: number; buffer: unknown; playbackRate: FakeParam; start(): void; stop(): void }> = [];
  const destination = node();
  const context = {
    currentTime: 0,
    state: "running",
    destination,
    resume: async () => {},
    createGain: () => {
      const gain = { ...node(), gain: param(1) };
      gains.push(gain);
      return gain;
    },
    createDynamicsCompressor: () => {
      const compressor = { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() };
      compressors.push(compressor);
      return compressor;
    },
    createBufferSource: () => {
      const source = { ...node(), loop: false, starts: 0, buffer: null as unknown, playbackRate: param(1), start() { source.starts++; }, stop() {} };
      sources.push(source);
      return source;
    },
    decodeAudioData: async () => ({}),
  } as unknown as MixerContext;
  const mixer = new SoundMixer({
    base: "",
    manifest: [{ id: "owner_theme", kind: "music", file_ogg: "assets/audio/music/owner_theme.ogg", seconds: 208, loop: true }],
    format: "ogg",
    context: () => context,
    fetchBytes: async () => new ArrayBuffer(0),
    musicVolume: 5,
  });
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return { mixer, gains, compressors, sources, destination, settle };
}

describe("format", () => {
  const plays = (...ok: string[]) => (m: string) => (ok.some((k) => m.includes(k)) ? "probably" : "");
  it("ogg where the browser plays Vorbis, else m4a (Safari), else nothing", () => {
    expect(pickFormat(plays("ogg", "mp4"))).toBe("ogg");
    expect(pickFormat(plays("mp4"))).toBe("m4a");
    expect(pickFormat(plays())).toBeNull();
    expect(pickFormat(undefined)).toBeNull();
  });
  it("an entry the build shipped in one format only falls back to it when the browser plays it", () => {
    const music: SoundEntry = { id: "owner_theme", kind: "music", file_ogg: "assets/audio/music/owner_theme.ogg", seconds: 208, loop: true };
    expect(fileFor(music, "ogg")).toBe(music.file_ogg);
    expect(fileFor(music, "m4a", plays("mp4"))).toBeNull();
    expect(fileFor(music, "m4a", plays("mp4", "ogg"))).toBe(music.file_ogg);
  });
});

describe("the music bus", () => {
  it("keeps the owner's theme through title, fly-over and town; inside a building −6 dB", () => {
    expect(musicFor({ phase: "title", daylight: 0, interior: false })).toEqual({ track: "owner_theme", gain: 1 });
    expect(musicFor({ phase: "cutscene", daylight: 0, interior: false }).track).toBe("owner_theme");
    expect(musicFor({ phase: "game", daylight: 0, interior: false })).toEqual({ track: "owner_theme", gain: 1 });
    expect(musicFor({ phase: "game", daylight: EVENING_AT - 0.01, interior: false }).track).toBe("owner_theme");
    expect(musicFor({ phase: "game", daylight: EVENING_AT, interior: false }).track).toBe("owner_theme");
    const inside = musicFor({ phase: "game", daylight: 0.25, interior: true });
    expect(inside.track).toBe("owner_theme");
    expect(20 * Math.log10(inside.gain)).toBeCloseTo(-6, 6);
    expect(dbToGain(0)).toBe(1);
    expect(CROSSFADE_S).toBe(1.5);
    expect(MUSIC_FADE_IN_S).toBe(2);
  });

  it("keeps one looping source for the same track and routes only music through the compressor", async () => {
    const h = audioHarness();
    h.mixer.setMusic("owner_theme", 1);
    h.mixer.unlock();
    await h.settle();
    h.mixer.setMusic("owner_theme", 0.5);
    await h.settle();

    expect(h.sources).toHaveLength(1);
    expect(h.sources[0].starts).toBe(1);
    expect(h.sources[0].loop).toBe(true);
    expect(h.compressors).toHaveLength(1);
    const [master, musicBus, ambientBus, sfxBus, musicVoice] = h.gains;
    expect(master.connections).toEqual([h.destination]);
    expect(musicBus.connections).toEqual([h.compressors[0]]);
    expect(h.compressors[0].connections).toEqual([master]);
    expect(ambientBus.connections).toEqual([master]);
    expect(sfxBus.connections).toEqual([master]);
    expect(musicVoice.connections).toEqual([musicBus]);
  });

  it.each([
    [5, 1],
    [-1, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("clamps music voice gain %s to finite [0,1] before the capped bus", async (asked, expected) => {
    const h = audioHarness();
    h.mixer.setMusic("owner_theme", asked);
    h.mixer.unlock();
    await h.settle();
    const voiceGain = h.gains[4].gain.ramps.at(-1);
    expect(voiceGain).toBe(expected);
    expect(voiceGain).toBeGreaterThanOrEqual(0);
    expect(voiceGain).toBeLessThanOrEqual(1);
    expect(h.gains[1].gain.value).toBeLessThanOrEqual(MUSIC_BUS_CAP);
    expect(voiceGain! * h.gains[1].gain.value).toBeLessThanOrEqual(MUSIC_BUS_CAP);
  });
});

describe("the ambient bus", () => {
  const water = waterDistance(town.grid);
  it("canal_water by distance to the real canal and lake: full at the water, silent from 25 m", () => {
    // on the stone bridge over the canal (x -28, z 18) and at the pier's end: water right there
    expect(water(-28, 18)).toBeLessThan(2);
    // the plaza's centre is well away from the canal (z 14.4-21.6) and the lake (west)
    const plaza = water(0, 0);
    expect(plaza).toBeGreaterThan(10);
    const near = ambientFor({ phase: "game", daylight: 0, interior: false, waterDistance: water(-28, 18) }).canal_water;
    const mid = ambientFor({ phase: "game", daylight: 0, interior: false, waterDistance: plaza }).canal_water;
    expect(near).toBeGreaterThan(0.9);
    expect(mid).toBeLessThan(near);
    expect(ambientFor({ phase: "game", daylight: 0, interior: false, waterDistance: WATER_RANGE_M }).canal_water).toBe(0);
    // the far north edge of the town: out of range
    expect(ambientFor({ phase: "game", daylight: 0, interior: false, waterDistance: water(40, -60) }).canal_water).toBe(0);
  });
  it("birds in the morning, fewer with cicadas in the afternoon, crickets in the evening, the soft murmur in the market; nothing indoors or on the title", () => {
    const day = ambientFor({ phase: "game", daylight: 0.2, interior: false, place: "street", waterDistance: 99 });
    expect(day.birds_day).toBe(0.6);
    expect(day.cicadas_day).toBe(0);
    expect(day.crickets_evening).toBe(0);
    expect(day.market_murmur).toBe(0);
    // the day's four slots: 0, 0.25 morning; 0.5 afternoon; 0.75 evening
    const noon = ambientFor({ phase: "game", daylight: 0.5, interior: false, place: "street", waterDistance: 99 });
    expect(0.5).toBeGreaterThanOrEqual(AFTERNOON_AT);
    expect(noon.cicadas_day).toBeGreaterThan(0);
    expect(noon.birds_day).toBeGreaterThan(0);
    expect(noon.birds_day).toBeLessThan(day.birds_day);
    expect(ambientFor({ phase: "game", daylight: 0.25, interior: false, waterDistance: 99 }).cicadas_day).toBe(0);
    const eve = ambientFor({ phase: "game", daylight: 0.8, interior: false, place: "market", waterDistance: 99 });
    expect(eve.birds_day).toBe(0);
    expect(eve.cicadas_day).toBe(0);
    expect(eve.crickets_evening).toBeGreaterThan(0);
    expect(eve.market_murmur).toBeGreaterThan(0);
    expect(eve.market_murmur).toBeLessThanOrEqual(0.5);
    for (const s of [ambientFor({ phase: "game", daylight: 0.2, interior: true, place: "market", waterDistance: 0, treeDistance: 0, pierDistance: 0 }), ambientFor({ phase: "title", daylight: 0, interior: false, waterDistance: 0, treeDistance: 0, pierDistance: 0 })])
      expect(Object.values(s).every((v) => v === 0)).toBe(true);
  });
  it("every bed in every result; the willows and the distant bell by the great tree, the boat's creak by the pier", () => {
    const far = ambientFor({ phase: "game", daylight: 0.2, interior: false, waterDistance: 99 });
    expect(Object.keys(far).sort()).toEqual([...AMBIENT_BEDS].sort());
    // wind in the willows everywhere outdoors, softly; stronger, with the bell, at the tree
    expect(far.willow_wind).toBe(0.2);
    expect(far.temple_bell_far).toBe(0);
    expect(far.boat_creak).toBe(0);
    const tree = town.buildings.find((b) => b.id === "great_tree")!;
    const at = ambientFor({ phase: "game", daylight: 0.2, interior: false, waterDistance: 99, treeDistance: 0 });
    expect(at.willow_wind).toBe(0.5);
    expect(at.temple_bell_far).toBe(0.6);
    // from the plaza's centre the tree is ~18 m off: the bell is heard, softer
    const plaza = ambientFor({ phase: "game", daylight: 0.8, interior: false, waterDistance: 99, treeDistance: Math.hypot(tree.pos[0], tree.pos[2]) });
    expect(plaza.temple_bell_far).toBeGreaterThan(0);
    expect(plaza.temple_bell_far).toBeLessThan(at.temple_bell_far);
    expect(ambientFor({ phase: "game", daylight: 0.2, interior: false, treeDistance: TREE_RANGE_M }).temple_bell_far).toBe(0);
    // the pier: its deck path from the real town
    const pier = town.decks.find((d) => d.kind === "pier")!;
    const [ex, , ez] = pier.path[pier.path.length - 1];
    expect(distanceToPath(pier.path, ex, ez)).toBeLessThan(1e-9);
    const onPier = ambientFor({ phase: "game", daylight: 0.2, interior: false, pierDistance: distanceToPath(pier.path, ex, ez) });
    expect(onPier.boat_creak).toBe(0.6);
    expect(ambientFor({ phase: "game", daylight: 0.2, interior: false, pierDistance: distanceToPath(pier.path, 0, 0) }).boat_creak).toBe(0);
    expect(distanceToPath(pier.path, 0, 0)).toBeGreaterThan(PIER_RANGE_M);
    expect(nearness(undefined, 10)).toBe(0);
    expect(nearness(5, 10)).toBe(0.5);
    expect(nearness(-1, 10)).toBe(1);
    expect(distanceToPath([[0, 0, 0], [10, 0, 0]], 5, 3)).toBeCloseTo(3);
    expect(distanceToPath([[0, 0, 0], [10, 0, 0]], -4, 3)).toBeCloseTo(5);
    expect(distanceToPath([], 0, 0)).toBe(Infinity);
  });
  it("light (prefs.ambienceFull off, the default): only canal_water, birds_day, crickets_evening, each capped; everything else silent", () => {
    const near = { phase: "game" as const, daylight: 0, interior: false, place: "market", waterDistance: 0, treeDistance: 0, pierDistance: 0 };
    const full = ambientFor(near, true);
    const light = ambientFor(near, false);
    expect(Object.keys(light).sort()).toEqual([...AMBIENT_BEDS].sort());
    // the full mix, right at the water / tree / pier, in the market: every other bed would be well above its light cap
    expect(full.canal_water).toBeGreaterThan(AMBIENT_LIGHT_CAPS.canal_water!);
    expect(full.birds_day).toBeGreaterThan(AMBIENT_LIGHT_CAPS.birds_day!);
    expect(full.willow_wind).toBeGreaterThan(0);
    expect(full.temple_bell_far).toBeGreaterThan(0);
    expect(full.boat_creak).toBeGreaterThan(0);
    expect(full.market_murmur).toBeGreaterThan(0);
    expect(light.canal_water).toBe(AMBIENT_LIGHT_CAPS.canal_water);
    expect(light.birds_day).toBe(AMBIENT_LIGHT_CAPS.birds_day);
    for (const id of ["cicadas_day", "willow_wind", "temple_bell_far", "market_murmur", "boat_creak"] as const) expect(light[id], id).toBe(0);
    // evening: crickets_evening is the one bed light mode still plays, capped lower than full
    const evening = { phase: "game" as const, daylight: EVENING_AT, interior: false };
    const fullEve = ambientFor(evening, true);
    const lightEve = ambientFor(evening, false);
    expect(fullEve.crickets_evening).toBeGreaterThan(AMBIENT_LIGHT_CAPS.crickets_evening!);
    expect(lightEve.crickets_evening).toBe(AMBIENT_LIGHT_CAPS.crickets_evening);
    // default argument: full (existing call sites unaffected)
    expect(ambientFor(near)).toEqual(full);
    // title / interior: silent in both modes
    for (const s of [ambientFor({ phase: "title", daylight: 0, interior: false }, false), ambientFor({ phase: "game", daylight: 0, interior: true }, false)])
      expect(Object.values(s).every((v) => v === 0)).toBe(true);
  });
});

describe("footsteps", () => {
  const at = (x: number, z: number) => {
    const d = deckAt(town.decks, x, z);
    return surfaceFor({ gridClass: gridClass(town.grid, x, z), deck: d?.deck ?? null });
  };
  it("the surface from the walk grid class and the decks", () => {
    expect(surfaceFor({ gridClass: 1 })).toBe("grass");
    for (const c of [2, 3, 4]) expect(surfaceFor({ gridClass: c })).toBe("stone");
    expect(surfaceFor({ gridClass: 3, interior: true })).toBe("wood");
    // the real town: the plaza is stone, the stone arch bridge stone, the wooden bridge and the pier wood
    expect(gridClass(town.grid, 0, 0)).toBe(3);
    expect(at(0, 0)).toBe("stone");
    expect(at(-28, 18)).toBe("stone");
    expect(at(28, 18)).toBe("wood");
    const pier = town.decks.find((d) => d.kind === "pier")!;
    const mid = pier.path[Math.floor(pier.path.length / 2)];
    expect(at(mid[0], mid[2])).toBe("wood");
    // somewhere on the grass: some class-1 cell of the grid
    const j = town.grid.classes.findIndex((row) => row.includes("1"));
    const i = town.grid.classes[j].indexOf("1");
    expect(at(town.grid.x0 + i + 0.5, town.grid.z0 + j + 0.5)).toBe("grass");
  });
  it("one of four at random, ±10 % pitch", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const r = (k * 0.618) % 1;
      const f = footstep("stone", () => r);
      seen.add(f.id);
      expect(f.rate).toBeGreaterThanOrEqual(0.9);
      expect(f.rate).toBeLessThanOrEqual(1.1);
    }
    expect([...seen].sort()).toEqual(["step_stone_1", "step_stone_2", "step_stone_3", "step_stone_4"]);
    expect(footstep("wood", () => 0.9999).id).toBe("step_wood_4");
  });
  it("two footfalls per stride of the walk clip, the first half a step in", () => {
    const c = new StrideClock(1.3);
    expect(c.advance(0.3)).toBe(0); // 0.325 + 0.3 < 0.65
    expect(c.advance(0.05)).toBe(1);
    let n = 0;
    for (let k = 0; k < 130; k++) n += c.advance(0.1); // 13 m more
    expect(n).toBe(20);
    c.reset();
    expect(c.advance(0.3)).toBe(0);
  });
});

describe("event effects", () => {
  it("a scene done, a mix-up, money in a shop or wages", () => {
    expect(sfxForEvent({ type: "sceneEnded" })).toBe("success_jingle");
    expect(sfxForEvent({ type: "actionPerformed", matched: false })).toBe("fail_soft");
    expect(sfxForEvent({ type: "actionPerformed", matched: true, tilesWrong: true })).toBe("fail_soft");
    expect(sfxForEvent({ type: "actionPerformed", matched: true })).toBeNull();
    expect(sfxForEvent({ type: "walletChanged", reason: "shopping" })).toBe("coin");
    expect(sfxForEvent({ type: "walletChanged", reason: "food" })).toBeNull();
    expect(sfxForEvent({ type: "lineSpoken" })).toBeNull();
  });
});

describe("the vendored sounds", () => {
  it("every id the game plays is in the manifest, with both files vendored", () => {
    const ids = new Set(manifest.map((e) => e.id));
    const used = [
      "owner_theme",
      ...AMBIENT_BEDS,
      "ui_tap", "ui_confirm", "ui_back", "ui_page", "ui_reveal", "tile_place", "tile_undo", "bubble_open", "bubble_close",
      "coin", "success_jingle", "fail_soft", "door_open", "door_close", "notebook_open", "cutscene_skip", "bell_temple",
      ...["stone", "grass", "wood"].flatMap((s) => [1, 2, 3, 4].map((n) => `step_${s}_${n}`)),
    ];
    for (const id of used) expect(ids, id).toContain(id);
    for (const e of manifest)
      for (const f of [e.file_ogg, e.file_m4a]) expect(existsSync(fileURLToPath(new URL(`../${f}`, import.meta.url))), f).toBe(true);
    for (const id of ["owner_theme", ...AMBIENT_BEDS]) expect(manifest.find((e) => e.id === id)!.loop, id).toBe(true);
    // a peaceful canal town: nothing in the set is (or is named as) traffic, engines, horns or sirens
    for (const e of manifest) {
      expect(e.description, e.id).toBeTruthy();
      const said = `${e.id} ${e.description}`.replace(/\bno [a-z]+/gi, ""); // "no engines" says what it isn't
      expect(said, e.id).not.toMatch(/scooter|engine|horn|siren|traffic|\bcar\b|motor|ambulance/i);
    }
  });
});

describe("prefs", () => {
  const kvOf = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), keys: () => [...data.keys()], data };
  };
  it("sound and quiet music on by default, ambience light by default, and the guide, apart from the shared settings key; junk and blocked storage: defaults", () => {
    const kv = kvOf();
    expect(loadPrefs(kv)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.music).toBe(0.6);
    expect(DEFAULT_PREFS.music * MUSIC_BUS_CAP).toBeLessThanOrEqual(0.25);
    expect(DEFAULT_PREFS.ambienceFull).toBe(false);
    savePrefs(kv, { sound: false, music: 0.3, musicSet: true, ambienceFull: true, guideHidden: true, pathHidden: true });
    expect(loadPrefs(kv)).toEqual({ sound: false, music: 0.3, musicSet: true, ambienceFull: true, guideHidden: true, pathHidden: true });
    expect([...kv.keys()]).toEqual([PREFS_KEY]);
    kv.data.set(PREFS_KEY, '{"music": 7, "sound": "x", "ambienceFull": "x"}');
    expect(loadPrefs(kv)).toEqual(DEFAULT_PREFS);
    const blocked = { ...kv, getItem: () => { throw new Error("no"); } };
    expect(loadPrefs(blocked)).toEqual(DEFAULT_PREFS);
  });
  it("migrates unflagged historical defaults while preserving legacy and explicitly flagged choices", () => {
    const kv = kvOf();
    for (const musicSet of [undefined, false]) {
      for (const music of [0, OLD_DEFAULT_MUSIC]) {
        kv.data.set(PREFS_KEY, JSON.stringify({ music, musicSet }));
        expect(loadPrefs(kv)).toMatchObject({ music: DEFAULT_PREFS.music, musicSet: false });
      }
      kv.data.set(PREFS_KEY, JSON.stringify({ music: 0.45, musicSet }));
      expect(loadPrefs(kv)).toMatchObject({ music: 0.45, musicSet: false });
    }
    for (const music of [0, OLD_DEFAULT_MUSIC]) {
      kv.data.set(PREFS_KEY, JSON.stringify({ music, musicSet: true }));
      expect(loadPrefs(kv)).toMatchObject({ music, musicSet: true });
    }
  });

  it("falls back to the music default for non-finite, out-of-range, and non-number storage", () => {
    const kv = kvOf();
    for (const music of [5, -1, Number.NaN, "x"]) {
      kv.data.set(PREFS_KEY, JSON.stringify({ music }));
      expect(loadPrefs(kv).music).toBe(DEFAULT_PREFS.music);
    }
  });
});
