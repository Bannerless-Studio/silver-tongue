import { comboKey, parseComboKey, resolveParams, type Combo } from "./combo";
import { addTrust, changeWallet, isAvailable } from "./life";
import {
  pickPreferred,
  recordRight,
  recordSeen,
  recordWrong,
  replyModeFor,
  wordState,
} from "./learner";
import { shuffle } from "./rng";
import type {
  Course,
  Exchange,
  GameEvent,
  GameState,
  RejectReason,
  RenderedLine,
  Scene,
  SceneRun,
  WordId,
  WordRecord,
} from "./types";

export interface Ctx {
  course: Course;
  state: GameState;
  now: number;
  rng: () => number;
  ev: GameEvent[];
}

export function reject(ctx: Ctx, reason: RejectReason): void {
  ctx.ev.push({ type: "inputRejected", reason });
}

export function setWord(
  ctx: Ctx,
  word: WordId,
  update: (rec: WordRecord | undefined, now: number) => WordRecord,
): void {
  const from = wordState(ctx.state.words[word], ctx.now);
  ctx.state.words[word] = update(ctx.state.words[word], ctx.now);
  const to = wordState(ctx.state.words[word], ctx.now);
  if (from !== to) ctx.ev.push({ type: "wordStateChanged", word, from, to });
}

/** The words of a line in reading order, as tiles. Punctuation is not a tile. */
export function tilePieces(line: RenderedLine): string[] {
  return line.tokens.map((t) => line.text.slice(t.start, t.end));
}

function sceneById(ctx: Ctx, id: string): Scene | undefined {
  return ctx.course.scenes.find((s) => s.id === id);
}

function hingeWords(ctx: Ctx, ex: Exchange, combo: Combo): WordId[] {
  const concepts = ex.hinges.map((h) => (h.startsWith("$") ? combo[h.slice(1)] : h));
  return [...new Set(concepts.flatMap((c) => ctx.course.concepts[c] ?? []))];
}

function chooseCombo(ctx: Ctx, ex: Exchange): Combo {
  const combo: Combo = {};
  for (const slot of Object.keys(ex.slots).sort()) {
    const values = ctx.course.groups[ex.slots[slot]];
    combo[slot] = pickPreferred(values, (c) => ctx.course.concepts[c] ?? [], ctx.state.words, ctx.now, ctx.rng);
  }
  return combo;
}

/** Records a heard line: each word is seen, and remembers the first line it was heard in. */
function hear(ctx: Ctx, line: RenderedLine): void {
  for (const t of line.tokens) {
    setWord(ctx, t.word, recordSeen);
    const rec = ctx.state.words[t.word];
    if (!rec.first) rec.first = { line: line.text, place: ctx.state.place };
  }
}

function speak(ctx: Ctx, npc: string, line: RenderedLine): void {
  ctx.ev.push({ type: "lineSpoken", npc, line });
  hear(ctx, line);
}

/** Right reply plus up to 3 replies that differ from it in exactly one slot, with distinct text. */
function pickOptions(ctx: Ctx, ex: Exchange, combo: Combo): string[] {
  const rightKey = comboKey(combo);
  const texts = new Set([ex.variants[rightKey].reply.text]);
  const wrong: string[] = [];
  for (const key of shuffle(Object.keys(ex.variants), ctx.rng)) {
    if (wrong.length === 3) break;
    const c = parseComboKey(key);
    const differing = Object.keys(combo).filter((s) => c[s] !== combo[s]).length;
    const text = ex.variants[key].reply.text;
    if (differing === 1 && !texts.has(text)) {
      texts.add(text);
      wrong.push(key);
    }
  }
  return shuffle([rightKey, ...wrong], ctx.rng);
}

/** The right reply's words plus up to 2 words from other replies. */
function buildTiles(ctx: Ctx, ex: Exchange, combo: Combo): string[] {
  const rightKey = comboKey(combo);
  const pieces = tilePieces(ex.variants[rightKey].reply);
  const extra = new Set<string>();
  for (const key of shuffle(Object.keys(ex.variants), ctx.rng)) {
    if (key === rightKey) continue;
    for (const p of tilePieces(ex.variants[key].reply)) if (!pieces.includes(p)) extra.add(p);
    if (extra.size >= 2) break;
  }
  return shuffle([...pieces, ...[...extra].slice(0, 2)], ctx.rng);
}

function optionsEvent(ex: Exchange, run: SceneRun): GameEvent {
  return run.mode === "pick"
    ? { type: "replyOptions", mode: "pick", options: run.options.map((k) => ex.variants[k].reply) }
    : { type: "replyOptions", mode: "tiles", tiles: run.tiles };
}

function emitOptions(ctx: Ctx, ex: Exchange): void {
  ctx.ev.push(optionsEvent(ex, ctx.state.run!));
}

/**
 * The events that draw the scene in progress, for a front end that starts from a save made
 * mid-scene. Changes nothing. Empty when there is no scene, or it no longer fits the course.
 */
export function describeRun(course: Course, state: GameState): GameEvent[] {
  const run = state.run;
  const scene = run && course.scenes.find((s) => s.id === run.scene);
  const ex = scene?.exchanges[run!.exchange];
  const v = ex?.variants[comboKey(run!.combo)];
  if (!run || !scene || !ex || !v) return [];
  return [
    { type: "sceneStarted", scene: scene.id, npc: scene.npc },
    { type: "lineSpoken", npc: scene.npc, line: v.npc },
    optionsEvent(ex, run),
  ];
}

function beginExchange(ctx: Ctx, scene: Scene, index: number): void {
  const run = ctx.state.run!;
  const ex = scene.exchanges[index];
  const combo = chooseCombo(ctx, ex);
  speak(ctx, scene.npc, ex.variants[comboKey(combo)].npc);
  const states = hingeWords(ctx, ex, combo).map((w) => wordState(ctx.state.words[w], ctx.now));
  const mode = replyModeFor(states, ctx.course.typing);
  run.exchange = index;
  run.combo = combo;
  run.misses = 0;
  // Typed replies arrive with the first typing-enabled pack; until then "type" plays as tiles.
  run.mode = mode === "type" ? "tiles" : mode;
  run.options = run.mode === "pick" ? pickOptions(ctx, ex, combo) : [];
  run.tiles = run.mode === "tiles" ? buildTiles(ctx, ex, combo) : [];
  emitOptions(ctx, ex);
}

function finishScene(ctx: Ctx, scene: Scene): void {
  const run = ctx.state.run!;
  ctx.state.run = null;
  ctx.state.scenesDone[scene.id] = (ctx.state.scenesDone[scene.id] ?? 0) + 1;
  ctx.ev.push({ type: "sceneEnded", scene: scene.id, earned: run.earned });
  ctx.ev.push(...changeWallet(ctx.state, run.earned, "wages"));
  ctx.ev.push(...addTrust(ctx.state, scene.npc, scene.trustGain + (run.mixups === 0 ? 1 : 0)));
}

function resolve(ctx: Ctx, scene: Scene, ex: Exchange, chosen: Combo, diff: string[], tilesWrong = false): void {
  const run = ctx.state.run!;
  const matched = diff.length === 0 && !tilesWrong;
  ctx.ev.push({
    type: "actionPerformed",
    action: resolveParams(ex.expect, chosen),
    expected: resolveParams(ex.expect, run.combo),
    matched,
    diff,
    tilesWrong,
  });
  const hinges = hingeWords(ctx, ex, run.combo);
  if (matched) {
    for (const w of hinges) setWord(ctx, w, recordRight);
    run.earned += ex.pay;
    if (run.exchange + 1 < scene.exchanges.length) beginExchange(ctx, scene, run.exchange + 1);
    else finishScene(ctx, scene);
    return;
  }
  for (const w of hinges) setWord(ctx, w, recordWrong);
  run.misses += 1;
  run.mixups += 1;
  ctx.ev.push(...changeWallet(ctx.state, -ex.missCost, "mixup"));
  const reaction = diff.map((d) => `wrong-${d}`).find((r) => ctx.course.reactions[r]) ?? "wrong-generic";
  ctx.ev.push({ type: "npcReacted", npc: scene.npc, reaction, line: ctx.course.reactions[reaction] });
  if (run.misses >= 2) {
    const v = ex.variants[comboKey(run.combo)];
    const line = v.rephrase ?? v.npc;
    ctx.ev.push({ type: "lineRephrased", npc: scene.npc, line, slow: !v.rephrase });
    hear(ctx, line);
  }
  emitOptions(ctx, ex);
}

export function startScene(ctx: Ctx, id: string): void {
  const scene = sceneById(ctx, id);
  if (!scene) return reject(ctx, "unknown-scene");
  if (ctx.state.run) return reject(ctx, "in-scene");
  if (scene.place !== ctx.state.place) return reject(ctx, "wrong-place");
  if (!isAvailable(scene, ctx.state)) return reject(ctx, "locked");
  if (ctx.state.slot >= ctx.course.world.slotsPerDay) return reject(ctx, "no-slots");
  ctx.state.slot += 1;
  ctx.state.run = {
    scene: id, exchange: 0, combo: {}, mode: "pick", options: [], tiles: [], misses: 0, earned: 0, mixups: 0,
  };
  ctx.ev.push({ type: "sceneStarted", scene: id, npc: scene.npc });
  beginExchange(ctx, scene, 0);
}

/** The running scene and exchange, or undefined if there is none or the save no longer fits the course. */
function current(ctx: Ctx): { scene: Scene; ex: Exchange } | undefined {
  const run = ctx.state.run;
  if (!run) return undefined;
  const scene = sceneById(ctx, run.scene);
  const ex = scene?.exchanges[run.exchange];
  if (!scene || !ex || !ex.variants[comboKey(run.combo)]) return undefined;
  return { scene, ex };
}

/** Slots that change the action. A slot the action doesn't use is never a mix-up. */
function actionDiff(ex: Exchange, chosen: Combo, expected: Combo): string[] {
  const got = resolveParams(ex.expect, chosen);
  const want = resolveParams(ex.expect, expected);
  return Object.keys(want).filter((k) => got[k] !== want[k]);
}

export function reply(ctx: Ctx, choice: number): void {
  const run = ctx.state.run;
  if (run && !current(ctx)) return reject(ctx, "stale-run");
  const cur = current(ctx);
  if (!cur || !run || run.mode !== "pick") return reject(ctx, "no-pick");
  const key = run.options[choice];
  if (key === undefined) return reject(ctx, "bad-choice");
  const chosen = parseComboKey(key);
  resolve(ctx, cur.scene, cur.ex, chosen, actionDiff(cur.ex, chosen, run.combo));
}

export function replyTiles(ctx: Ctx, tiles: number[]): void {
  const run = ctx.state.run;
  if (run && !current(ctx)) return reject(ctx, "stale-run");
  const cur = current(ctx);
  if (!cur || !run || run.mode !== "tiles") return reject(ctx, "no-tiles");
  if (tiles.some((i) => run.tiles[i] === undefined)) return reject(ctx, "bad-tile");
  const answer = tiles.map((i) => run.tiles[i]).join("");
  const target = tilePieces(cur.ex.variants[comboKey(run.combo)].reply).join("");
  resolve(ctx, cur.scene, cur.ex, run.combo, [], answer !== target);
}
