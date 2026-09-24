export type Combo = Record<string, string>;

export function comboKey(combo: Combo): string {
  return Object.keys(combo)
    .sort()
    .map((k) => `${k}=${combo[k]}`)
    .join("|");
}

export function parseComboKey(key: string): Combo {
  const out: Combo = {};
  if (!key) return out;
  for (const part of key.split("|")) {
    const [k, v] = part.split("=");
    out[k] = v;
  }
  return out;
}

/** Every slot assignment for an exchange, e.g. {count: three, item: tea}. */
export function allCombos(slots: Record<string, string>, groups: Record<string, string[]>): Combo[] {
  let acc: Combo[] = [{}];
  for (const slot of Object.keys(slots).sort()) {
    const values = groups[slots[slot]];
    if (!values) throw new Error(`unknown group "${slots[slot]}" for slot "${slot}"`);
    acc = acc.flatMap((c) => values.map((v) => ({ ...c, [slot]: v })));
  }
  return acc;
}

/** Replaces "$slot" values with the combo's concept. */
export function resolveParams(params: Record<string, string>, combo: Combo): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) out[k] = v.startsWith("$") ? combo[v.slice(1)] : v;
  return out;
}
