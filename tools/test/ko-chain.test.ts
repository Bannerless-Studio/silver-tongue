import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  availableSceneIds,
  comboKey,
  createCore,
  mulberry32,
  newGame,
  personalize,
  sceneCost,
  tilePieces,
  type Course,
  type GameState,
  type Input,
} from "@silver-tongue/core";
import { extra } from "@silver-tongue/view";
import { stepToward } from "../src/bots";
import { buildCourse } from "../src/build-course";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));

/** ko-seoul stage 1: each scene answers a need the one before it raised (spec section 11). */
const CHAIN = [
  "room-wake",
  "street-hello",
  "street-again",
  "street-what",
  "street-hungry",
  "shop-prices",
  "street-numbers",
  "shop-count",
  "stall-intro",
  "stall-shift",
  "stall-family",
  "room-rent",
];

/** The right reply in whatever mode the core asks for. */
function rightReply(course: Course, state: GameState): Input {
  const run = state.run!;
  const v = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange].variants[comboKey(run.combo)];
  if (run.mode === "pick") return { type: "reply", choice: run.options.indexOf(comboKey(run.combo)) };
  if (run.mode === "type") return { type: "replyText", text: personalize(v.reply, state.player ?? "?").text };
  const used = new Set<number>();
  const tiles = tilePieces(v.reply).map((p) => {
    const i = run.tiles.findIndex((t, j) => t === p && !used.has(j));
    used.add(i);
    return i;
  });
  return { type: "replyTiles", tiles };
}

/** Plays from a new game: the chain in order, then one visit to the shop. `idleNights` sleeps that many nights after waking first. */
function playChain(c: Course, idleNights: number) {
  let clock = 0;
  const core = createCore(c, newGame(c), { now: () => clock, rng: mulberry32(1) });
  const wallet: number[] = [];
  const send = (input: Input) => {
    clock += 3_600_000;
    const ev = core.send(input);
    expect(ev.filter((e) => e.type === "inputRejected"), JSON.stringify(input)).toEqual([]);
    for (const e of ev) if (e.type === "walletChanged") wallet.push(e.wallet);
  };
  const walkTo = (place: string) => {
    while (core.state.place !== place) {
      const step = stepToward(c, core.state.place, new Set([place]), core.state);
      expect(step, `a way to ${place}`).toBeDefined();
      send({ type: "goTo", place: step! });
    }
  };
  const sleep = () => {
    walkTo(c.world.home!);
    send({ type: "sleep" });
  };
  const play = (id: string) => {
    if (core.state.slot >= c.world.slotsPerDay) sleep();
    walkTo(c.scenes.find((s) => s.id === id)!.place);
    send({ type: "startScene", scene: id });
    for (let n = 0; core.state.run && n < 50; n++) send(rightReply(c, core.state));
    expect(core.state.run ?? null, id).toBeNull();
    expect(core.state.scenesDone[id], id).toBe(1);
  };
  const openOneOffs = () => availableSceneIds(c, core.state).filter((id) => !c.scenes.find((s) => s.id === id)!.repeatable);
  if (c.needsName) send({ type: "setName", name: "Sam" });

  for (const [i, id] of CHAIN.entries()) {
    // The story offers exactly this scene next (a job, once found, stays open beside it).
    if (!c.scenes.find((s) => s.id === id)!.repeatable) expect(openOneOffs(), `before ${id}`).toEqual([id]);
    else expect(availableSceneIds(c, core.state), `before ${id}`).toContain(id);
    play(id);
    if (i === 0) for (let n = 0; n < idleNights; n++) sleep();
  }
  expect(openOneOffs()).toEqual([]);
  // Shopping opens with the clerk's apology, and the wages pay for it.
  expect(availableSceneIds(c, core.state)).toContain("shop-buy");
  play("shop-buy");
  return { state: core.state, wallet };
}

describe("ko-seoul's stage-1 chain", () => {
  const { course, errors } = buildCourse(CONTENT, "ko-seoul");

  it("builds with the chain plus the shop, one-off except the jobs", () => {
    expect(errors).toEqual([]);
    expect(course!.scenes.map((s) => s.id).sort()).toEqual([...CHAIN, "shop-buy"].sort());
    expect(course!.scenes.filter((s) => s.repeatable).map((s) => s.id).sort()).toEqual(["shop-buy", "stall-shift"]);
  });

  it("a new player plays it in order: each scene opens only after the one before, never blocked", () => {
    const { state, wallet } = playChain(course!, 0);
    expect(Math.min(...wallet)).toBeGreaterThan(0);
    expect(state.day).toBeLessThanOrEqual(4);
  });

  it("no story scene before the first job costs money, so a player who spent every won is never stuck", () => {
    for (const id of CHAIN.slice(0, CHAIN.indexOf("stall-shift"))) expect(sceneCost(course!.scenes.find((s) => s.id === id)!), id).toBe(0);
    const { wallet } = playChain(course!, 6);
    expect(wallet).toContain(0);
  });

  it("keeps the three pinned clue lines word for word", () => {
    const pinned = extra(course!).scenes.flatMap((s) => s.exchanges.filter((ex) => ex.pin).map((ex) => `${s.id}: ${Object.values(ex.variants)[0].npc.text}`));
    expect(pinned.sort()).toEqual([
      "room-rent: 민준 씨는 삼월까지 냈어요.",
      "room-wake: 민준 씨 친구예요?",
      "stall-family: 동생이에요. 지금 없어요.",
    ]);
  });
});
