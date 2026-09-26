import { buildCourse } from "./build-course.js";
import { BOTS, runBot } from "./bots.js";
const dir = process.argv[2];
const r: any = buildCourse(dir, "zh-china-en");
const errs: string[] = r.errors ?? [];
const other = errs.filter((e) => !e.startsWith("coverage"));
console.log("errors:", other.length); for (const e of other.slice(0, 60)) console.log("  " + e);
const by: Record<string, string[]> = {};
for (const e of errs.filter((e) => e.startsWith("coverage"))) { const m = e.match(/"(.+)" \(stage \d\) is in (\d+)/)!; (by[m[2]] ??= []).push(m[1]); }
for (const k of Object.keys(by).sort()) console.log("cov", k, by[k].length, by[k].join(" "));
if (!other.length && r.course && process.argv[3] === "bots") for (const [n, b] of Object.entries(BOTS)) { const x = runBot(r.course, b, { days: 14, seed: 7 }); console.log(n, JSON.stringify({ ...x, firstDone: undefined })); }
if (process.argv[3] === "where" && r.course) {
  const c = r.course; const use = new Map<string, Set<string>>();
  for (const s of c.scenes) for (const ex of s.exchanges) for (const v of Object.values(ex.variants) as any[]) for (const l of [v.npc, v.reply, v.rephrase]) for (const t of l?.tokens ?? []) { const w = c.words[t.word]; if (w.bonus || w.lv !== "1") continue; if (!use.has(w.w)) use.set(w.w, new Set()); use.get(w.w)!.add(s.id); }
  const all = Object.values(c.words).filter((w: any) => !w.bonus && w.lv === "1").map((w: any) => w.w);
  for (const w of all) { const n = use.get(w)?.size ?? 0; if (n < 3) console.log(n, w, [...(use.get(w) ?? [])].join(" ")); }
}
