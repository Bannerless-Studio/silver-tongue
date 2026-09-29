import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { extra } from "@silver-tongue/view";
import { buildCourse } from "../src/build-course";
import { letterProblems } from "../src/letters";
import { clipId } from "../src/voices";

const CONTENT = fileURLToPath(new URL("../../content", import.meta.url));
const WORDS_VOICE = "zh-CN-XiaoxiaoNeural";

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** Builds zh-china from a copy of the real content after `change` edits it. */
function buildChanged(change: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "st-book-"));
  temps.push(dir);
  const audio = join(CONTENT, "audio");
  cpSync(CONTENT, dir, { recursive: true, filter: (src) => src !== audio });
  if (existsSync(audio)) symlinkSync(audio, join(dir, "audio"));
  change(dir);
  return buildCourse(dir, "zh-china");
}

const editJson = (dir: string, path: string, edit: (data: any) => void) => {
  const p = join(dir, path);
  const data = JSON.parse(readFileSync(p, "utf8"));
  edit(data);
  writeFileSync(p, JSON.stringify(data));
};

const LETTERS = {
  groups: [
    { id: "consonants", letters: [{ ch: "ㄱ", name: "기역", reading: "g/k", say: "기역." }, { ch: "ㄴ", name: "니은", reading: "n" }] },
    { id: "vowels", letters: [{ ch: "ㅏ", reading: "a" }] },
  ],
};

describe("letters.json", () => {
  it("is embedded in the course, each letter with its clip in the words voice", () => {
    const { course, errors, clips } = buildChanged((d) => writeFileSync(join(d, "languages/zh/letters.json"), JSON.stringify(LETTERS)));
    const ids = [clipId(WORDS_VOICE, "기역."), clipId(WORDS_VOICE, "니은"), clipId(WORDS_VOICE, "ㅏ")];
    const letters = extra(course!).letters!;
    expect(letters.groups.map((g) => g.id)).toEqual(["consonants", "vowels"]);
    expect(letters.groups.flatMap((g) => g.letters.map((l) => l.audio))).toEqual(ids.map((id) => [id]));
    expect(letters.groups[0].letters[0]).toMatchObject({ ch: "ㄱ", name: "기역", reading: "g/k" });
    // npm run audio makes (and keeps) the letters' clips; until then the audio check misses them
    expect(clips.filter((c) => ids.includes(c.id)).map((c) => c.text)).toEqual(expect.arrayContaining(["기역.", "니은", "ㅏ"]));
    expect(clips.map((c) => c.id)).toEqual([...clips.map((c) => c.id)].sort());
    expect(errors.sort()).toEqual(ids.map((id) => `audio: no file for clip ${id}`).sort());
  });

  it("needs each group named in the learner's text", () => {
    const { errors } = buildChanged((d) =>
      writeFileSync(join(d, "languages/zh/letters.json"), JSON.stringify({ groups: [{ id: "tones", letters: [{ ch: "ˉ", reading: "1" }] }] })),
    );
    expect(errors).toContain('learner/en/ui.ftl: missing "letters-group-tones"');
  });

  it("reports a broken chart and ships none", () => {
    const { course, errors } = buildChanged((d) => writeFileSync(join(d, "languages/zh/letters.json"), JSON.stringify({ groups: [] })));
    expect(errors).toContain('letters.json: "groups" must be a non-empty list');
    expect(extra(course!).letters).toBeUndefined();
  });

  it("reports a chart that isn't JSON", () => {
    const bad = buildChanged((d) => writeFileSync(join(d, "languages/zh/letters.json"), "{nope"));
    expect(bad.errors.some((e) => e.startsWith("letters.json: "))).toBe(true);
  });

  it("a course without letters.json has no chart and no letter errors", () => {
    const { course, errors } = buildCourse(CONTENT, "zh-china");
    expect(errors).toEqual([]);
    expect(extra(course!).letters).toBeUndefined();
  });

  it("names each problem", () => {
    expect(letterProblems(LETTERS)).toEqual([]);
    expect(letterProblems(null)).toEqual(['letters.json: "groups" must be a non-empty list']);
    expect(letterProblems({ groups: "x" })).toEqual(['letters.json: "groups" must be a non-empty list']);
    expect(letterProblems({ groups: [{ id: "a b", letters: [{ ch: "x" }] }] })).toEqual(['letters.json: group "a b": id must be letters, digits, _ and -']);
    expect(letterProblems({ groups: [{ letters: [{ ch: "x" }] }] })).toEqual(["letters.json: group 1: id must be letters, digits, _ and -"]);
    expect(letterProblems({ groups: [{ id: "a", letters: [{ ch: "x" }] }, { id: "a", letters: [{ ch: "y" }] }] })).toEqual(['letters.json: group "a": id is used twice']);
    expect(letterProblems({ groups: [{ id: "a", letters: [] }] })).toEqual(['letters.json: group "a": "letters" must be a non-empty list']);
    expect(letterProblems({ groups: [{ id: "a", letters: [{ name: "x" }, { ch: "" }] }] })).toEqual([
      'letters.json: group "a": a letter has no "ch"',
      'letters.json: group "a": a letter has no "ch"',
    ]);
    expect(letterProblems({ groups: [{ id: "a", letters: [{ ch: "x" }, { ch: "x" }] }] })).toEqual(['letters.json: group "a": "x" is listed twice']);
    // the same letter in two groups is fine (a final consonant is also a consonant)
    expect(letterProblems({ groups: [{ id: "a", letters: [{ ch: "x" }] }, { id: "b", letters: [{ ch: "x" }] }] })).toEqual([]);
    expect(letterProblems({ groups: [{ id: "a", letters: [{ ch: "x", name: 3, reading: "", say: "ok" }] }] })).toEqual([
      'letters.json: group "a": "x" name must be text',
      'letters.json: group "a": "x" reading must be text',
    ]);
    expect(letterProblems({ groups: [{ id: "a", letters: [{ ch: "x", audio: ["c1"], sound: "x" }] }] })).toEqual([
      'letters.json: group "a": "x" has an unknown field "audio"',
      'letters.json: group "a": "x" has an unknown field "sound"',
    ]);
  });
});

describe("pinned exchanges", () => {
  it("carry pin into the course", () => {
    const { course, errors } = buildChanged((d) =>
      editJson(d, "settings/china-city/scenes/noodle-intro.json", (sk) => {
        sk.exchanges[0].pin = true;
      }),
    );
    expect(errors).toEqual([]);
    const scene = extra(course!).scenes.find((s) => s.id === "noodle-intro")!;
    expect(scene.exchanges[0].pin).toBe(true);
    expect(scene.exchanges[1].pin).toBeUndefined();
  });

  it("must have no slots, and pin must be true or false", () => {
    const { errors } = buildChanged((d) => {
      editJson(d, "settings/china-city/scenes/noodle-shift.json", (sk) => {
        sk.exchanges.find((x: { id: string }) => x.id === "order").pin = true;
      });
      editJson(d, "settings/china-city/scenes/noodle-intro.json", (sk) => {
        sk.exchanges[0].pin = "yes";
      });
    });
    expect(errors).toContain("noodle-shift/order: a pinned exchange must have no slots");
    expect(errors).toContain("noodle-intro/greet: pin must be true or false");
  });
});

describe("attach words and the tile gap", () => {
  it("copies attach (with the word's other spellings) and tileGap into the course", () => {
    const { course, errors } = buildChanged((d) => {
      editJson(d, "languages/zh/words.json", (words) => {
        const w = words.find((x: { w: string }) => x.w === "了");
        w.attach = true;
        w.alt = ["啦"];
      });
      editJson(d, "languages/zh/pack.json", (p) => {
        p.tileGap = " ";
      });
    });
    expect(errors).toEqual([]);
    const c = extra(course!);
    expect(c.language.tileGap).toBe(" ");
    expect(Object.values(c.words).find((w) => w.w === "了")).toMatchObject({ attach: true, alt: ["啦"] });
    // words without attach keep no alt, as before
    expect(Object.values(c.words).filter((w) => w.alt)).toHaveLength(1);
  });

  it("leaves both out when unset", () => {
    const { course } = buildCourse(CONTENT, "zh-china");
    expect("tileGap" in course!.language).toBe(false);
    expect(Object.values(extra(course!).words).some((w) => "attach" in w)).toBe(false);
  });

  it("reports an attach that isn't true or false", () => {
    const { errors } = buildChanged((d) =>
      editJson(d, "languages/zh/words.json", (words) => {
        words.find((x: { w: string }) => x.w === "了").attach = "yes";
      }),
    );
    expect(errors.some((e) => /: attach must be true or false$/.test(e) && e.includes('"了"'))).toBe(true);
  });

  it("copies book: true into the course, and reports a book that isn't true or false", () => {
    const on = buildChanged((d) => editJson(d, "languages/zh/pack.json", (p) => void (p.book = true)));
    expect(on.errors).toEqual([]);
    expect(extra(on.course!).language.book).toBe(true);
    const { course } = buildCourse(CONTENT, "zh-china");
    expect("book" in course!.language).toBe(false);
    const bad = buildChanged((d) => editJson(d, "languages/zh/pack.json", (p) => void (p.book = "yes")));
    expect(bad.errors).toContain('pack.json: "book" must be true or false, got "yes"');
  });

  it("reports a tileGap that isn't text", () => {
    const { errors } = buildChanged((d) =>
      editJson(d, "languages/zh/pack.json", (p) => {
        p.tileGap = 1;
      }),
    );
    expect(errors).toContain('pack.json: "tileGap" must be text, got 1');
  });
});
