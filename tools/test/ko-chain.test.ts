import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  availableSceneIds,
  comboKey,
  createCore,
  mulberry32,
  mentorAvailable,
  newGame,
  personalize,
  sceneCost,
  tilePieces,
  type Course,
  type GameState,
  type Input,
} from "@silver-tongue/core";
import { anchorRow, extra, makeText, menuDirection, npcLabel, placeMenu, primaryItem } from "@silver-tongue/view";
import { createQuiet } from "../../packages/quiet-web/src/quiet";
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

/** Stage 2's scenes: the letter opens them once stage 1 is done. */
const STAGE2 = ["room-letter", "campus-labmate", "copy-intro", "copy-shift", "room-creditor"];

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
  expect(openOneOffs()).toEqual(["room-letter"]);
  // Shopping opens with the clerk's apology, and the wages pay for it.
  expect(availableSceneIds(c, core.state)).toContain("shop-buy");
  play("shop-buy");
  return { state: core.state, wallet };
}

/**
 * Plays from a new game pressing only the one bright control (primaryItem) between scenes, with
 * unavailable items left out as the quiet page leaves them out. Returns the scenes in the order played.
 */
function followBright(c: Course) {
  let clock = 0;
  const core = createCore(c, newGame(c), { now: () => clock, rng: mulberry32(1) });
  const t = makeText(c.learnerFtl, c.learner);
  const send = (input: Input) => {
    clock += 3_600_000;
    const ev = core.send(input);
    expect(ev.filter((e) => e.type === "inputRejected"), JSON.stringify(input)).toEqual([]);
    return ev;
  };
  if (c.needsName) send({ type: "setName", name: "Sam" });
  const played: string[] = [];
  const rentShown: boolean[] = [];
  for (let n = 0; n < 200 && !core.state.scenesDone["room-rent"]; n++) {
    const menu = placeMenu(c, core.state, t).filter((m) => !("disabled" in m && m.disabled));
    const i = primaryItem(c, core.state, menu) ?? (menu.length === 1 ? 0 : undefined);
    expect(i, `a bright control at ${core.state.place}, day ${core.state.day}`).toBeDefined();
    const item = menu[i!];
    send(item.input);
    if (item.kind !== "talk") continue;
    played.push(item.scene);
    rentShown.push(!!anchorRow(c, core.state, t).rent);
    for (let k = 0; core.state.run && k < 50; k++) send(rightReply(c, core.state));
  }
  return { played, rentShown, state: core.state, t };
}

describe("ko-seoul's stage-1 chain", () => {
  const { course, errors } = buildCourse(CONTENT, "ko-seoul");

  it("builds with the chain plus the shop, one-off except the jobs", () => {
    expect(errors).toEqual([]);
    expect(course!.scenes.map((s) => s.id).sort()).toEqual([...CHAIN, "shop-buy", ...STAGE2].sort());
    expect(course!.scenes.filter((s) => s.repeatable).map((s) => s.id).sort()).toEqual(["copy-shift", "shop-buy", "stall-shift"]);
  });

  it("keeps the first three scenes within six words, scenes through shop-count within eight, and lines within two", () => {
    // The desk teaches these words; names never count toward the learning budget.
    const seen = new Set(["ko-sinmun", "ko-wol", "ko-won"]);
    const names = new Set<string>();
    for (const file of ["words.json", "extra-words.json"]) {
      const words = JSON.parse(readFileSync(`${CONTENT}/languages/ko/${file}`, "utf8")) as { id: string; name?: boolean }[];
      for (const w of words) if (w.name) names.add(w.id);
    }
    for (const id of CHAIN) {
      const scene = course!.scenes.find((s) => s.id === id)!;
      expect(scene.stage, id).toBe(1);
      const started = new Set(seen);
      for (const ex of scene.exchanges) {
        const exchangeWords = new Set<string>();
        for (const v of Object.values(ex.variants)) {
          const local = new Set(seen);
          for (const [kind, line] of [["NPC", v.npc], ["reply", v.reply], ["rephrase", v.rephrase]] as const) {
            if (!line) continue;
            const words = new Set(line.tokens.map((t) => t.word).filter((w) => !names.has(w)));
            const fresh = [...words].filter((w) => !local.has(w));
            expect(fresh.length, `${id}/${ex.id} ${kind}: ${fresh.join(" ")}`).toBeLessThanOrEqual(2);
            for (const w of words) { local.add(w); exchangeWords.add(w); }
          }
        }
        for (const w of exchangeWords) seen.add(w);
      }
      if (CHAIN.indexOf(id) <= CHAIN.indexOf("shop-count")) {
        const limit = CHAIN.indexOf(id) <= CHAIN.indexOf("street-again") ? 6 : 8;
        expect([...seen].filter((w) => !started.has(w)).length, id).toBeLessThanOrEqual(limit);
      }
    }
  });

  it("teaches 저, 어디 and 은 in stage 1, with introductions followed by greetings before name questions", () => {
    const words = new Set(course!.scenes.filter((s) => s.stage === 1).flatMap((s) =>
      s.exchanges.flatMap((ex) => Object.values(ex.variants).flatMap((v) => [...v.npc.tokens, ...v.reply.tokens].map((t) => t.word))),
    ));
    for (const word of ["ko-jeo", "ko-eodi", "ko-eun"]) expect(words.has(word), word).toBe(true);
    const intro = course!.scenes.find((s) => s.id === "stall-intro")!;
    const jiwoo = Object.values(intro.exchanges.find((ex) => ex.id === "jiwoo")!.variants)[0];
    const name = Object.values(intro.exchanges.find((ex) => ex.id === "name")!.variants)[0];
    expect(jiwoo.reply.text).toBe("지우 씨, 안녕하세요.");
    expect(name.reply.text).not.toBe(jiwoo.reply.text);
  });

  it("uses two purposeful repeats, answers every alt, and keeps repeat requests out of wrong replies", () => {
    const scene = course!.scenes.find((s) => s.id === "street-again")!;
    expect(scene.after).toEqual(["street-hello"]);
    expect(course!.scenes.find((s) => s.id === "street-what")!.after).toEqual([scene.id]);
    expect(scene.exchanges.map((ex) => ex.id)).toEqual(["fast", "again", "slow"]);
    const variants = scene.exchanges.map((ex) => Object.values(ex.variants)[0]);
    expect(variants.map((v) => v.reply.text)).toEqual(["다시 말해 주세요.", "천천히 말해 주세요. 감사합니다.", "아니요, 몰라요."]);
    for (const [i, v] of variants.entries()) {
      for (const [j, alt] of (v.alts ?? []).entries()) {
        const outcome = v.altOutcomes?.[String(j)];
        expect(outcome?.reaction?.meaning, `${scene.id}/${scene.exchanges[i].id}: ${alt.text}`).toBeTruthy();
        if (i > 0) expect(alt.text).not.toBe("네?");
        expect(["네?", "다시 말해 주세요.", "천천히 말해 주세요."], `${scene.id}/${scene.exchanges[i].id}`).not.toContain(alt.text);
        expect(outcome?.accept).not.toBe(true);
      }
    }
  });

  it("keeps the mentor out of the first day and labels every slot-spending action with its cost", () => {
    expect(course!.world.mentor?.after).toBe("shop-count");
    const t = makeText(course!.learnerFtl, course!.learner);
    const early = newGame(course!);
    early.place = "street";
    early.scenesDone["street-hello"] = 1;
    early.notes.ready = ["yo"];
    expect(mentorAvailable(course!, early)).toBe(false);
    expect(placeMenu(course!, early, t).some((m) => m.kind === "mentor")).toBe(false);

    const played = followBright(course!).state;
    const state = { ...played, slot: 0, notes: { ...played.notes, ready: ["yo"] }, wallet: 20000 };
    const suffix = " · takes the rest of this part of the day";
    const at = (place: string) => placeMenu(course!, { ...state, place }, t);
    expect(at("street").find((m) => m.kind === "mentor")?.label).toBe(`Ask Grandpa Park about the language${suffix}`);
    for (const [place, id] of [["stall", "stall-shift"], ["shop", "shop-buy"]]) {
      expect(at(place).find((m) => m.kind === "talk" && m.scene === id)?.label, id).toContain(suffix);
    }
    const opening = placeMenu(course!, newGame(course!), t).find((m) => m.kind === "talk");
    expect(opening?.label).toContain(suffix);
    expect(at("shop").find((m) => m.kind === "talk")?.label).toContain(t("menu-cost-money", { currency: "₩", cost: 1000 }));
  });

  it("explains exhausted time on a Book menu both in the alley and beside the bed", () => {
    const { state, t } = followBright(course!);
    expect(menuDirection(course!, { ...state, slot: 0 }, t)).toEqual([]);
    for (const place of ["street", "room"]) {
      const exhausted = { ...state, place, slot: course!.world.slotsPerDay };
      const core = createCore(course!, exhausted, { now: () => 0, rng: mulberry32(1) });
      const q = createQuiet({ course: course!, core, now: () => 0 });
      const phase = q.view().phase;
      expect(phase.kind).toBe("explore");
      if (phase.kind !== "explore") throw new Error("expected a place menu");
      expect(phase.waiting).toContain(t("menu-day-used"));
      expect(phase.menu.some((m) => m.kind === "talk" || m.kind === "mentor")).toBe(false);
      expect(phase.menu.some((m) => m.kind === (place === "room" ? "sleep" : "go"))).toBe(true);
    }
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

  it("the one bright control between scenes always leads to the next scene of the chain", () => {
    const { played } = followBright(course!);
    expect(played).toEqual(CHAIN);
  });

  it("rent stays off the top bar until the landlady brings it up; names wait for introductions", () => {
    const { played, rentShown, state, t } = followBright(course!);
    expect(extra(course!).scenes.filter((s) => s.rent).map((s) => s.id)).toEqual(["room-rent"]);
    expect(rentShown.slice(0, played.indexOf("room-rent") + 1).some(Boolean)).toBe(false);
    // Short of rent and two days from it, but nobody has mentioned rent: nothing on the bar.
    const short = { ...state, day: 6, wallet: 0, scenesDone: { ...state.scenesDone, "room-rent": 0 } };
    expect(anchorRow(course!, short, t).rent).toBeUndefined();
    expect(anchorRow(course!, { ...short, scenesDone: state.scenesDone }, t).rent).toBeDefined();
    expect(npcLabel(course!, state, t, "oldman")).toBe("Grandpa Park");
    const fresh = newGame(course!);
    expect(npcLabel(course!, fresh, t, "oldman")).toBe("The old man");
    expect(npcLabel(course!, fresh, t, "landlady")).toBe("The landlady");
  });

  it("a wrong reply always looks wrong: never a reply the scene wants, never a request to hear it again", () => {
    // A miss repeats the line, slower. A written wrong reply must never be a right reply
    // elsewhere in the scene or a request whose repeated line looks like a successful answer.
    const repeatRequests = ["네?", "다시 말해 주세요.", "천천히 말해 주세요."];
    for (const s of course!.scenes) {
      const variants = s.exchanges.flatMap((ex) => Object.values(ex.variants));
      const right = new Set(variants.map((v) => v.reply.text));
      for (const ex of s.exchanges)
        for (const v of Object.values(ex.variants))
          for (const alt of v.alts ?? []) {
            expect(right.has(alt.text), `${s.id}/${ex.id}: ${alt.text}`).toBe(false);
            expect(repeatRequests, `${s.id}/${ex.id}`).not.toContain(alt.text);
            expect(alt.meaning && alt.intent, `${s.id}/${ex.id}: ${alt.text}`).toBeTruthy();
          }
      for (const v of variants) expect(v.reply.meaning && v.reply.intent, `${s.id}: ${v.reply.text}`).toBeTruthy();
      // A right reply moves the line on, so the player can tell it from a miss.
      const single = s.exchanges.filter((ex) => Object.keys(ex.variants).length === 1).map((ex) => Object.values(ex.variants)[0].npc.text);
      for (let i = 1; i < single.length; i++) expect(single[i], `${s.id}: line ${i}`).not.toBe(single[i - 1]);
    }
  });

  it("keeps the pinned clue lines word for word", () => {
    const pinned = extra(course!).scenes.flatMap((s) => s.exchanges.filter((ex) => ex.pin).map((ex) => `${s.id}: ${Object.values(ex.variants)[0].npc.text}`));
    expect(pinned.sort()).toEqual([
      "campus-labmate: 민준 씨가 책을 가져갔어요.",
      "campus-labmate: 민준 씨는 삼월부터 안 왔어요.",
      "room-creditor: 다음 주에 또 올게요.",
      "room-rent: 민준 씨는 삼월까지 냈어요.",
      "room-wake: 민준 씨 친구예요?",
      "stall-family: 동생이에요. 지금 없어요.",
    ]);
  });
});
