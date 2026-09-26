/** The part of `document` the page metas need. */
export interface MetaSource {
  querySelector(sel: string): { getAttribute(name: string): string | null } | null;
}

/** A `<meta name=…>` value set by the page (or rewritten by the site build); "" when absent. */
export function metaContent(doc: MetaSource, name: string): string {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
}

/** Where the catalog, course files, art and clips are: next to the page unless the site says otherwise. */
export function coursesBase(doc: MetaSource): string {
  return metaContent(doc, "st-courses") || "courses/";
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}
