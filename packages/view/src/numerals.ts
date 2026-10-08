/**
 * Japanese numbers written in kanji, read as one number: 百五十 is "hyakugojū", not "hyaku go jū",
 * and the sound changes come out right (三百 "sanbyaku", 八千 "hassen"). Up to 九千九百九十九万….
 */

const DIGITS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

/** Whether every character is a kanji numeral (一…九, 十, 百, 千, 万). */
export const isJaNumeral = (text: string): boolean => text.length > 0 && [...text].every((ch) => ch in DIGITS || ch in UNITS || ch === "万");

const ONES = ["", "ichi", "ni", "san", "yon", "go", "roku", "nana", "hachi", "kyū"];
/** 百 and 千 after each digit, with their sound changes; 1 is left out (百, not 一百). */
const HUNDREDS = ["", "hyaku", "nihyaku", "sanbyaku", "yonhyaku", "gohyaku", "roppyaku", "nanahyaku", "happyaku", "kyūhyaku"];
const THOUSANDS = ["", "sen", "nisen", "sanzen", "yonsen", "gosen", "rokusen", "nanasen", "hassen", "kyūsen"];

/** 0…9999 in romaji; "" for 0. */
function below10k(n: number): string {
  const th = Math.floor(n / 1000);
  const h = Math.floor(n / 100) % 10;
  const t = Math.floor(n / 10) % 10;
  const o = n % 10;
  return THOUSANDS[th] + HUNDREDS[h] + (t ? (t > 1 ? ONES[t] : "") + "jū" : "") + ONES[o];
}

/** The value of a kanji numeral below 10,000 (三百五十 -> 350); undefined if it isn't well formed. */
function value10k(text: string): number | undefined {
  let total = 0;
  let digit: number | undefined;
  let last = Infinity;
  for (const ch of text) {
    if (ch in DIGITS) {
      if (digit !== undefined) return undefined;
      digit = DIGITS[ch];
    } else {
      const u = UNITS[ch];
      if (u === undefined || u >= last) return undefined;
      total += (digit ?? 1) * u;
      digit = undefined;
      last = u;
    }
  }
  return total + (digit ?? 0);
}

/** The romaji reading of a kanji numeral as one number; undefined when it isn't one. */
export function jaNumeralRomaji(text: string): string | undefined {
  if (!isJaNumeral(text)) return undefined;
  if (!text.includes("万")) {
    const n = value10k(text);
    return n ? below10k(n) : undefined;
  }
  const [high, low, ...rest] = text.split("万");
  if (rest.length) return undefined;
  const lowValue = value10k(low);
  const highValue = high ? value10k(high) : 1;
  if (!highValue || lowValue === undefined) return undefined;
  return below10k(highValue) + "man" + below10k(lowValue);
}
