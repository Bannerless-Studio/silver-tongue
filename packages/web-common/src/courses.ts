import type { CatalogEntry } from "@silver-tongue/core";
import { chooseStart, learnerFor, type PlayerSettings, type Start } from "@silver-tongue/view";
import type { KeyValue } from "./web-storage";

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

/** The catalog and course files are fetched with revalidation: a page just deployed must never pair with a course
 * file the browser cached from the deploy before (the site serves them with a 10-minute max-age and an ETag). */
export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/** Whether this browser has a saved game for any course. */
export function hasAnySession(kv: KeyValue): boolean {
  try {
    return kv.keys().some((k) => /^silver-tongue:[^:]+:session:/.test(k));
  } catch {
    return false;
  }
}

/**
 * The course a page starts on. A page made for one course (the `st-course` meta, e.g. /ko/) starts
 * there: for a first visit it becomes the player's course (`remember`); a player with games already
 * gets it for this visit only, their own choice kept and switching still in settings. A course the
 * catalog doesn't have is ignored: the page starts as it would without the meta.
 */
export function pageStart(catalog: CatalogEntry[], settings: PlayerSettings, pageCourse: string, anySession: boolean): { start: Start; remember: boolean } {
  const course = pageCourse ? catalog.find((c) => c.id === pageCourse) : undefined;
  if (course) return { start: { ask: false, course, learner: learnerFor(course, settings.learner) }, remember: !anySession };
  return { start: chooseStart(catalog, settings), remember: true };
}
