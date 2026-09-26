import { allCombos, comboKey } from "../combo";
import type { Course, Exchange, RenderedLine, Variant } from "../types";

/** Builds a line from [text, wordId | null] parts; null parts are punctuation. */
export function line(...parts: [string, string | null][]): RenderedLine {
  let text = "";
  const tokens: RenderedLine["tokens"] = [];
  for (const [t, word] of parts) {
    if (word) tokens.push({ start: text.length, end: text.length + t.length, word });
    text += t;
  }
  return { text, tokens };
}

const W: Record<string, [string, string, string[]?]> = {
  w_ni: ["你", "you", ["nǐ"]],
  w_hao: ["好", "good", ["hǎo"]],
  w_cha: ["茶", "tea"],
  w_shui: ["水", "water"],
  w_san: ["三", "three"],
  w_si: ["四", "four"],
  x_bei: ["杯", "cup (measure word)"],
  w_bu: ["不", "not"],
  w_shi: ["是", "to be"],
  w_zhe: ["这", "this"],
  w_ge: ["个", "(measure word)"],
};
const CONCEPT_WORD: Record<string, string> = { tea: "w_cha", water: "w_shui", three: "w_san", four: "w_si" };
const w = (concept: string): [string, string] => [W[CONCEPT_WORD[concept]][0], CONCEPT_WORD[concept]];
const GROUPS = { drinks: ["tea", "water"], nums: ["three", "four"] };

function variants(slots: Record<string, string>, make: (c: Record<string, string>) => Variant): Record<string, Variant> {
  return Object.fromEntries(allCombos(slots, GROUPS).map((c) => [comboKey(c), make(c)]));
}

const greet: Exchange = {
  id: "greet",
  slots: {},
  expect: { action: "greet" },
  hinges: [],
  pay: 0,
  missCost: 0,
  variants: {
    "": {
      npc: { ...line(["你", "w_ni"], ["好", "w_hao"], ["！", null]), meaning: "Hello!" },
      reply: { ...line(["你", "w_ni"], ["好", "w_hao"], ["！", null]), meaning: "Hello!" },
      // Written wrong replies may only use words met by now: here, the greeting's own.
      alts: [line(["好", "w_hao"], ["！", null]), line(["好", "w_hao"], ["你", "w_ni"], ["！", null])],
    },
  },
};

const menu: Exchange = {
  id: "menu",
  slots: { item: "drinks" },
  expect: { action: "repeat", item: "$item" },
  hinges: ["$item"],
  pay: 0,
  missCost: 1,
  variants: variants({ item: "drinks" }, (c) => ({ npc: line(w(c.item), ["。", null]), reply: line(w(c.item), ["？", null]) })),
};

const order: Exchange = {
  id: "order",
  slots: { item: "drinks", count: "nums" },
  expect: { action: "serve", item: "$item", count: "$count" },
  hinges: ["$item", "$count"],
  pay: 3,
  missCost: 2,
  variants: variants({ item: "drinks", count: "nums" }, (c) => ({
    npc: line(w(c.count), ["杯", "x_bei"], w(c.item), ["。", null]),
    reply: line(["好", "w_hao"], ["，", null], w(c.count), ["杯", "x_bei"], w(c.item), ["。", null]),
    rephrase: line(w(c.item), ["。", null], w(c.count), ["杯", "x_bei"], ["。", null]),
  })),
};

/**
 * A two-scene course that passes the content checker: meet the cook, then serve drinks (repeatable).
 * Each call returns a fresh copy, so a test can change it without affecting others.
 */
export function fixtureCourse(): Course {
  return structuredClone({
    id: "test-course",
    learner: "en",
    language: { code: "zh", locale: "zh", tts: "zh-CN", spaced: false },
    typing: false,
    words: Object.fromEntries(
      Object.entries(W).map(([id, [text, gloss, readings]]) => [
        id,
        { id, w: text, lv: "1", gloss, ...(readings ? { readings } : {}), ...(id.startsWith("x_") ? { bonus: true } : {}) },
      ]),
    ),
    concepts: { tea: ["w_cha"], water: ["w_shui"], three: ["w_san"], four: ["w_si"] },
    groups: GROUPS,
    world: {
      start: "street",
      currency: "¥",
      slotsPerDay: 4,
      startWallet: 20,
      foodPerDay: 5,
      rentPerWeek: 50,
      places: { street: { links: ["noodle_shop"] }, noodle_shop: { links: ["street"] } },
      npcs: { cook: { place: "noodle_shop" } },
    },
    scenes: [
      { id: "intro", place: "noodle_shop", npc: "cook", stage: 1, after: [], requires: {}, repeatable: false, trustGain: 1, exchanges: [greet, menu] },
      { id: "shift", place: "noodle_shop", npc: "cook", stage: 1, after: ["intro"], requires: { trust: { cook: 1 } }, repeatable: true, trustGain: 1, exchanges: [order] },
    ],
    reactions: {
      "wrong-generic": line(["不", "w_bu"], ["是", "w_shi"], ["这", "w_zhe"], ["个", "w_ge"], ["。", null]),
    },
    learnerFtl: "",
    conceptNames: { tea: "tea", water: "water", three: "three", four: "four" },
    stageWords: { "1": [...Object.keys(W), "w_unused"] },
    notes: [],
    needsName: false,
  } satisfies Course);
}

/** A made-up spaced language for the same two scenes: every word has a native and a plain reading. */
const SPACED: Record<string, [string, string[]]> = {
  w_ni: ["mi", ["mí", "mi"]],
  w_hao: ["bon", ["bón", "bon"]],
  w_cha: ["te", ["té", "te"]],
  w_shui: ["akva", ["ákva", "akva"]],
  w_san: ["tri", ["trí", "tri"]],
  w_si: ["kvar", ["kvár", "kvar"]],
  x_bei: ["tas", ["tás", "tas"]],
  w_bu: ["ne", ["né", "ne"]],
  w_shi: ["estas", ["éstas", "estas"]],
  w_zhe: ["ci", ["cí", "ci"]],
  w_ge: ["unu", ["únu", "unu"]],
};
const PUNCT: Record<string, string> = { "，": ",", "。": ".", "！": "!", "？": "?" };
const ascii = (s: string) => [...s].map((c) => PUNCT[c] ?? c).join("");

/** The same line in the spaced language: words swapped, a space before every word but the first. */
function respace(l: RenderedLine): RenderedLine {
  const parts: [string, string | null][] = [];
  let at = 0;
  for (const tk of l.tokens) {
    const gap = ascii(l.text.slice(at, tk.start));
    if (gap) parts.push([gap, null]);
    if (parts.length) parts.push([" ", null]);
    parts.push([SPACED[tk.word][0], tk.word]);
    at = tk.end;
  }
  const tail = ascii(l.text.slice(at));
  if (tail) parts.push([tail, null]);
  return { ...l, ...line(...parts) };
}

/** The fixture course in a made-up spaced language, read in `learner`. */
export function spacedCourse(learner = "en"): Course {
  const c = fixtureCourse();
  c.id = "xx-town";
  c.learner = learner;
  c.language = { code: "xx", locale: "en", tts: "en-US", spaced: true };
  for (const [id, word] of Object.entries(c.words)) {
    word.w = SPACED[id][0];
    word.readings = SPACED[id][1];
  }
  for (const s of c.scenes)
    for (const ex of s.exchanges)
      for (const v of Object.values(ex.variants)) {
        v.npc = respace(v.npc);
        v.reply = respace(v.reply);
        if (v.rephrase) v.rephrase = respace(v.rephrase);
        if (v.alts) v.alts = v.alts.map(respace);
      }
  for (const [id, l] of Object.entries(c.reactions)) c.reactions[id] = respace(l);
  return c;
}

/**
 * Adds a delivery: a repeatable pickup at the noodle shop whose `to` slot names the school (a new
 * place off the street), and a repeatable drop-off at the school that ends the errand and pays 4.
 */
export function addErrand(course: Course): Course {
  course.world.places.street.links.push("school");
  course.world.places.school = { links: ["street"] };
  course.world.npcs.teacher = { place: "school" };
  course.concepts.school = ["w_zhe"];
  course.conceptNames.school = "school";
  course.groups.dests = ["school"];
  const hello = structuredClone(course.scenes[0].exchanges[0]);
  course.scenes.push(
    {
      id: "pickup", place: "noodle_shop", npc: "cook", stage: 1, after: ["intro"], requires: {}, repeatable: true, trustGain: 1,
      startsErrand: "$to",
      exchanges: [
        {
          id: "parcel", slots: { to: "dests" }, expect: { action: "deliver", to: "$to" }, hinges: ["$to"], pay: 0, missCost: 1,
          variants: {
            [comboKey({ to: "school" })]: {
              npc: line(["这", "w_zhe"], ["。", null]),
              reply: line(["好", "w_hao"], ["，", null], ["这", "w_zhe"], ["。", null]),
              alts: [line(["你", "w_ni"], ["好", "w_hao"], ["！", null])],
            },
          },
        },
      ],
    },
    {
      id: "drop", place: "school", npc: "teacher", stage: 1, after: ["pickup"], requires: {}, repeatable: true, trustGain: 1,
      endsErrand: true, exchanges: [{ ...hello, pay: 4 }],
    },
  );
  return course;
}
