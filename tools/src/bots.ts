import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  availableSceneIds,
  comboKey,
  createCore,
  mulberry32,
  newGame,
  sceneCost,
  tilePieces,
  wordState,
  type Course,
  type GameState,
  type Input,
  type SceneRun,
} from "@silver-tongue/core";

/** How a bot answers: given the run, whether to give the right reply this time. */
export interface Bot {
  answerRight(run: SceneRun, rng: () => number): boolean;
}

/** Give up being wrong after this many misses on one exchange, so no bot is stuck forever. */
const MAX_MISSES = 4;

export const BOTS: Record<string, Bot> = {
  right: { answerRight: () => true },
  /** wrong twice on every exchange (so the NPC rephrases), then right */
  wrong: { answerRight: (run) => run.misses >= 2 },
  random: { answerRight: (run, rng) => run.misses >= MAX_MISSES || rng() < 0.5 },
  learner: { answerRight: (run, rng) => run.misses >= MAX_MISSES || rng() < 0.7 },
};

export interface BotReport {
  /** one-off scene -> the day it was first finished */
  firstDone: Record<string, number>;
  minWallet: number;
  maxWallet: number;
  /** days that began with no scene available anywhere */
  deadEndDays: number;
  /** moments with no money and no paying repeatable scene available */
  brokeWithoutWork: number;
  notesRead: number;
  wordsHeard: number;
  wordsKnown: number;
  endWallet: number;
  /** inputs the core refused; a sensible player never sends one */
  rejected: number;
  /** parcels delivered */
  errands: number;
  /** purchases made */
  shopping: number;
  /** nights that ended with rent still owed */
  rentLateNights: number;
  /** total wages */
  earned: number;
  /** total spent at the shop */
  shoppingSpent: number;
  /** the lowest wallet right after paying rent; Infinity if rent was never paid */
  minAfterRent: number;
}

const HOUR = 3_600_000;

/** The right reply, or a wrong one when there is one. */
function replyInput(course: Course, state: GameState, right: boolean, rng: () => number): Input {
  const run = state.run!;
  if (run.mode === "pick") {
    const good = run.options.indexOf(comboKey(run.combo));
    const bad = run.options.map((_, i) => i).filter((i) => i !== good);
    const choice = right || !bad.length ? good : bad[Math.floor(rng() * bad.length)];
    return { type: "reply", choice };
  }
  const ex = course.scenes.find((s) => s.id === run.scene)!.exchanges[run.exchange];
  const used = new Set<number>();
  const order = tilePieces(ex.variants[comboKey(run.combo)].reply).map((p) => {
    const i = run.tiles.findIndex((t, j) => t === p && !used.has(j));
    used.add(i);
    return i;
  });
  if (right || order.length < 2) return { type: "replyTiles", tiles: order };
  return { type: "replyTiles", tiles: [...order].reverse() };
}

/** The next place on a shortest walk from `from` to any place in `targets`, or undefined. */
function stepToward(course: Course, from: string, targets: Set<string>): string | undefined {
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    if (targets.has(p) && p !== from) {
      let step = p;
      while (prev.get(step) !== from) step = prev.get(step)!;
      return step;
    }
    for (const next of course.world.places[p].links) {
      if (!prev.has(next)) {
        prev.set(next, p);
        queue.push(next);
      }
    }
  }
  return undefined;
}

/** Something worth doing, and where: lower `rank` first. */
export interface Goal {
  rank: number;
  place: string;
  input: Input;
  /** times done already: among equal ranks the bot tries what it has done least, so every job gets played */
  done: number;
}

/**
 * What a sensible player wants next: a one-off scene (new story), the mentor's waiting notes,
 * paid repeatable work, then unpaid practice.
 */
export function goals(course: Course, state: GameState): Goal[] {
  const { rentPerWeek, foodPerDay } = course.world;
  // Rent comes at the end of every 7th day. With it due tonight or tomorrow night and not enough
  // money for it plus food, a sensible player works before following the story. Rent that is
  // already late doesn't count: the landlord waits, and a player who can't earn (the wrong bot
  // earns nothing) would otherwise never see the story again.
  const rentClose = state.day % 7 === 0 || state.day % 7 === 6;
  const workFirst = rentClose && state.wallet < rentPerWeek + 2 * foodPerDay;
  const out: Goal[] = availableSceneIds(course, state)
    // Repeat shopping never eats into tonight's food or the rent money, and waits while rent is
    // late; a first visit is the story, so it's taken.
    .filter((id) => {
      const scene = course.scenes.find((s) => s.id === id)!;
      const cost = sceneCost(scene);
      if (cost === 0 || !scene.repeatable) return true;
      return !state.rentLate && state.wallet - cost >= course.world.rentPerWeek + course.world.foodPerDay;
    })
    .map((id) => {
    const scene = course.scenes.find((s) => s.id === id)!;
    // A parcel in hand comes first; a pickup is paid work, since the trip pays at the other end.
    const paid = scene.repeatable && (scene.startsErrand !== undefined || scene.exchanges.some((ex) => ex.pay > 0));
    const rank = scene.endsErrand ? 1 : !scene.repeatable ? (workFirst ? 2 : 0) : paid ? (workFirst ? 0 : 2) : 3;
    return { rank, place: scene.place, input: { type: "startScene", scene: id }, done: state.scenesDone[id] ?? 0 };
  });
  const m = course.world.mentor;
  if (m && state.notes.ready.length && (state.scenesDone[m.after] ?? 0) > 0) {
    out.push({ rank: 1, place: course.world.npcs[m.npc].place, input: { type: "visitMentor" }, done: 0 });
  }
  return out.sort((a, b) => a.rank - b.rank || a.done - b.done);
}

/**
 * Plays `days` game days. Each step: answer if in a scene; else take the best goal (see `goals`)
 * here, or walk toward the nearest place with it; sleep (at home, walking there first) when out
 * of slots or goals.
 */
export function runBot(course: Course, bot: Bot, opts: { days: number; seed: number }): BotReport {
  let clock = 0;
  const rng = mulberry32(opts.seed);
  const core = createCore(course, newGame(course), { now: () => clock, rng: mulberry32(opts.seed + 1) });
  const report: BotReport = {
    firstDone: {},
    minWallet: core.state.wallet,
    maxWallet: core.state.wallet,
    deadEndDays: 0,
    brokeWithoutWork: 0,
    notesRead: 0,
    wordsHeard: 0,
    wordsKnown: 0,
    endWallet: 0,
    rejected: 0,
    errands: 0,
    shopping: 0,
    rentLateNights: 0,
    earned: 0,
    shoppingSpent: 0,
    minAfterRent: Infinity,
  };
  const paying = (id: string) => {
    const s = course.scenes.find((x) => x.id === id)!;
    return s.repeatable && (s.startsErrand !== undefined || s.exchanges.some((ex) => ex.pay > 0));
  };
  let dayChecked = 0;
  if (course.needsName) core.send({ type: "setName", name: "Bot" });

  for (let steps = 0; core.state.day <= opts.days && steps < 100_000; steps++) {
    const s = core.state;
    if (dayChecked !== s.day) {
      dayChecked = s.day;
      if (!availableSceneIds(course, s).length) report.deadEndDays += 1;
    }
    if (s.wallet === 0 && !s.run && !availableSceneIds(course, s).some(paying)) report.brokeWithoutWork += 1;

    let input: Input = { type: "sleep" };
    const wanted = goals(course, s);
    const best = wanted.filter((g) => g.rank === wanted[0]?.rank);
    const here = best.find((g) => g.place === s.place);
    if (s.run) input = replyInput(course, s, bot.answerRight(s.run, rng), rng);
    else if (s.slot < course.world.slotsPerDay && best.length) {
      const step = here ? undefined : stepToward(course, s.place, new Set(best.map((g) => g.place)));
      if (here) input = here.input;
      else if (step) input = { type: "goTo", place: step };
    }
    // Bed is at home: walk there before sleeping.
    const home = course.world.home;
    if (input.type === "sleep" && home && s.place !== home) {
      const step = stepToward(course, s.place, new Set([home]));
      if (step) input = { type: "goTo", place: step };
    }
    clock += HOUR;
    const events = core.send(input);
    if (events.some((e) => e.type === "inputRejected")) {
      // A bot repeats itself, so a refused input would be refused forever: stop and report it.
      report.rejected += 1;
      break;
    }
    if (events.some((e) => e.type === "dayEnded") && core.state.rentLate) report.rentLateNights += 1;
    for (const e of events) {
      if (e.type === "walletChanged") {
        report.minWallet = Math.min(report.minWallet, e.wallet);
        report.maxWallet = Math.max(report.maxWallet, e.wallet);
      }
      if (e.type === "errandEnded") report.errands += 1;
      if (e.type === "walletChanged" && e.reason === "shopping") {
        report.shopping += 1;
        report.shoppingSpent -= e.delta;
      }
      if (e.type === "walletChanged" && e.reason === "wages") report.earned += e.delta;
      if (e.type === "walletChanged" && e.reason === "rent") report.minAfterRent = Math.min(report.minAfterRent, e.wallet);
      if (e.type === "sceneEnded" && !course.scenes.find((x) => x.id === e.scene)!.repeatable) {
        report.firstDone[e.scene] ??= core.state.day;
      }
    }
  }
  const end = core.state;
  report.notesRead = end.notes.read.length;
  report.wordsHeard = Object.keys(end.words).length;
  report.wordsKnown = Object.values(end.words).filter((r) => wordState(r, clock) === "known").length;
  report.endWallet = end.wallet;
  return report;
}

function main(): void {
  const courseId = process.argv[2] ?? "zh-china-en";
  const days = Number(process.argv[3] ?? 14);
  const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const course = JSON.parse(readFileSync(join(repo, "dist", "courses", courseId, "course.json"), "utf8")) as Course;
  const oneOff = course.scenes.filter((s) => !s.repeatable).map((s) => s.id);
  console.log(`${courseId}, ${days} days. One-off scenes: day first finished.\n`);
  for (const [name, bot] of Object.entries(BOTS)) {
    const r = runBot(course, bot, { days, seed: 7 });
    const done = oneOff.map((id) => `${id}:${r.firstDone[id] ?? "-"}`).join(" ");
    console.log(`${name.padEnd(8)} wallet ${r.minWallet}..${r.maxWallet} (end ${r.endWallet}) · words ${r.wordsKnown} known / ${r.wordsHeard} heard · notes ${r.notesRead}/${course.notes.length} · dead-end days ${r.deadEndDays} · broke without work ${r.brokeWithoutWork} · rejected ${r.rejected} · errands ${r.errands} · shopping ${r.shopping} · rent late ${r.rentLateNights} · earned ${r.earned} · spent ${r.shoppingSpent} · after rent ${r.minAfterRent}`);
    console.log(`         ${done}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
