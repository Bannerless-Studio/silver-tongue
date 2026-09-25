import { parseSave, serialize, type Course, type GameState, type ParseResult } from "@silver-tongue/core";

/**
 * A save as one line of text, to move a game between devices and between the terminal and the
 * browser: "st1:" and the base64 of the deflated save JSON. Uses web APIs that Node 22 also has.
 */
const PREFIX = "st1:";

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function encodeSave(state: GameState): Promise<string> {
  const packed = await transform(new TextEncoder().encode(serialize(state)), new CompressionStream("deflate-raw"));
  return PREFIX + toBase64(packed);
}

/** The reverse of encodeSave, as strict as loading a save. Spaces and line breaks (from copying) are ignored. */
export async function decodeSave(line: string, course: Course): Promise<ParseResult> {
  const text = line.replace(/\s+/g, "");
  const body = text.startsWith(PREFIX) ? text.slice(PREFIX.length) : "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return { ok: false, reason: "not-a-save" };
  let json: string;
  try {
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    json = new TextDecoder("utf-8", { fatal: true }).decode(await transform(bytes, new DecompressionStream("deflate-raw")));
  } catch {
    return { ok: false, reason: "not-a-save" };
  }
  return parseSave(json, course);
}
