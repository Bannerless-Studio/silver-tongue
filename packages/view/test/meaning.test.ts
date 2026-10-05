import { describe, expect, it } from "vitest";
import { bestMeaning, contentWords, meaningMatches, meaningScore, normalizeMeaning } from "../src/meaning";
import { scribeAccepts } from "../src/scribe";

/** The real meanings of room-wake and street-hello, with the accepts the page uses. */
const ok = (typed: string, meaning: string) => meaningMatches(typed, meaning, scribeAccepts(meaning));

describe("normalizeMeaning", () => {
  it("lowercases, strips accents and punctuation, spells out contractions", () => {
    expect(normalizeMeaning("  Who’s THERE?! ")).toBe("who is there");
    expect(normalizeMeaning("Café…")).toBe("cafe");
    expect(normalizeMeaning("I don't know.")).toBe("i do not know");
    expect(normalizeMeaning("i dont know")).toBe("i do not know");
    expect(normalizeMeaning("Min-jun's friend")).toBe("minjun friend");
    expect(normalizeMeaning("thanks")).toBe("thank you");
  });
  it("drops small words from the content", () => {
    expect(contentWords(normalizeMeaning("Well… goodbye."))).toEqual(["goodbye"]);
    expect(contentWords(normalizeMeaning("No, I don't."))).toEqual(["no", "not"]);
  });
});

describe("meaningMatches", () => {
  it("matches the same words, however typed", () => {
    expect(ok("who is it", "Who is it?")).toBe(true);
    expect(ok("Who's it?", "Who is it?")).toBe(true);
    expect(ok("WHO IS IT!!", "Who is it?")).toBe(true);
    expect(ok("who is there", "Who is it?")).toBe(true);
  });
  it("takes the real room-wake and street-hello meanings", () => {
    expect(ok("no", "No.")).toBe(true);
    expect(ok("nope", "No.")).toBe(true);
    expect(ok("I am Alex", "I'm Alex.")).toBe(true);
    expect(ok("im alex", "I'm Alex.")).toBe(true);
    expect(ok("I don't know", "I don't know.")).toBe(true);
    expect(ok("i do not know", "I don't know.")).toBe(true);
    expect(ok("no idea", "I don't know.")).toBe(true);
    expect(ok("goodbye", "Goodbye.")).toBe(true);
    expect(ok("bye", "Goodbye.")).toBe(true);
    expect(ok("hello", "Hello.")).toBe(true);
    expect(ok("hi", "Hello.")).toBe(true);
    expect(ok("thank you", "Thank you.")).toBe(true);
    expect(ok("thanks", "Thank you.")).toBe(true);
    expect(ok("no, I don't", "No, I don't.")).toBe(true);
    expect(ok("no", "No, I don't.")).toBe(true);
    expect(ok("well goodbye", "Well… goodbye.")).toBe(true);
    expect(ok("min jun", "Min-jun? Min-jun!")).toBe(true);
    expect(ok("where is minjun", "Where's Min-jun?")).toBe(true);
    expect(ok("i am minjun's friend", "I'm Min-jun's friend.")).toBe(true);
  });
  it("allows a couple of extra content words, not more", () => {
    expect(ok("oh, hello there", "Hello.")).toBe(true);
    expect(ok("hello there friend", "Hello.")).toBe(true);
    expect(ok("hello there dear old friend", "Hello.")).toBe(false);
  });
  it("rejects a different meaning", () => {
    expect(ok("hello", "Goodbye.")).toBe(false);
    expect(ok("who are you", "Hello.")).toBe(false);
    expect(ok("yes", "No.")).toBe(false);
    expect(ok("", "No.")).toBe(false);
    expect(ok("  ?! ", "Hello.")).toBe(false);
  });
  it("never lets a negation flip the meaning", () => {
    expect(ok("I am not Alex", "I'm Alex.")).toBe(false);
    expect(ok("I know", "I don't know.")).toBe(false);
    expect(ok("yes i do", "No, I don't.")).toBe(false);
  });
  it("is whole-word", () => {
    expect(ok("helloo", "Hello.")).toBe(false);
    expect(ok("nothing", "No.")).toBe(false);
  });
});

describe("bestMeaning", () => {
  const opts = [{ meaning: "I'm Min-jun." }, { meaning: "I'm Min-jun's friend." }, { meaning: "Who are you?" }];
  it("picks the closest reply", () => {
    expect(bestMeaning("I'm Min-jun's friend", opts)).toBe(1);
    expect(bestMeaning("i am minjun", opts)).toBe(0);
    expect(bestMeaning("who are you", opts)).toBe(2);
    expect(bestMeaning("goodbye", opts)).toBe(-1);
  });
  it("breaks a tie by order", () => {
    expect(bestMeaning("goodbye", [{ meaning: "Goodbye." }, { meaning: "Goodbye." }])).toBe(0);
  });
  it("scores exact matches below loose ones", () => {
    expect(meaningScore("hello", "Hello.")).toBe(0);
    expect(meaningScore("hello friend", "Hello.")).toBe(2);
  });
});

describe("a negation in the meaning", () => {
  it("lets 'not' say 'no', and does not count it as an extra word", () => {
    expect(ok("no, I'm not", "No.")).toBe(true);
    expect(ok("no, I'm not his friend", "No.")).toBe(true);
    expect(ok("I'm not his friend", "No.")).toBe(true);
  });
  it("still never lets an added negation flip a meaning without one", () => {
    expect(ok("I'm not his friend", "I'm his friend.")).toBe(false);
    expect(bestMeaning("I'm not his friend", [{ meaning: "I'm his friend." }, { meaning: "Who are you?" }])).toBe(-1);
  });
  it("matches nothing for a bare yes or friend", () => {
    expect(ok("yes", "No.")).toBe(false);
    expect(ok("friend", "No.")).toBe(false);
  });
});

describe("natural phrasing of the scribe scenes' lines", () => {
  const cases: [string, string[]][] = [
    ["Sit here.", ["sit down", "have a seat", "please sit", "sit", "sit down here", "take a seat"]],
    ["Do you know Korean?", ["do you speak korean", "can you speak korean", "you know korean", "do you understand korean"]],
    ["I'm Grandpa Park.", ["grandfather park", "i am grandfather park", "he is park", "i am grandpa park"]],
    ["Hello, Grandpa Park.", ["hello", "hi", "hi grandpa park", "hello grandfather park"]],
    ["What's your name?", ["what is your name", "whats your name", "your name", "what are you called"]],
    ["Are you Min-jun's friend?", ["are you min jun's friend", "are you minjun's friend", "are you a friend of min-jun"]],
    ["Where's Min-jun?", ["where is min jun", "wheres minjun", "where is min-jun"]],
    ["I'm Min-jun.", ["i am min jun", "im minjun"]],
    ["I'm Min-jun's friend.", ["i am min jun's friend", "im a friend of minjun"]],
    ["Who are you?", ["who are you", "who r you".replace("r", "are")]],
    ["No, I don't.", ["no", "no i don't speak korean", "i don't speak korean"]],
    ["Yes, I do.", ["yes", "yes i speak korean", "i do"]],
    ["Thank you.", ["thanks", "thank you so much", "thank you grandpa"]],
    ["Goodbye.", ["bye", "bye bye", "see you"]],
  ];
  for (const [meaning, typed] of cases) it(`${meaning}`, () => void typed.forEach((t) => expect(ok(t, meaning), t).toBe(true)));
  it("does not let a safe accept pick the opposite line", () => {
    expect(ok("hello", "Goodbye, Grandpa Park.")).toBe(false);
    expect(ok("hello grandpa park", "Goodbye, Grandpa Park.")).toBe(false);
    expect(ok("sit down", "Goodbye.")).toBe(false);
  });
});
