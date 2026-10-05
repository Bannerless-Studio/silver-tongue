import type { CatalogEntry } from "@silver-tongue/core";
import { chooseStart, learnerFor, type PlayerSettings, type Start } from "@silver-tongue/view";

/** The part of `document` the page metas need. */
export interface MetaSource {
  querySelector(sel: string): { getAttribute(name: string): string | null } | null;
}

/** A `<meta name=…>` value set by the page (or rewritten by the site build); "" when absent. */
export function metaContent(doc: MetaSource, name: string): string {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
}

/** The lab build marks its page with `<meta name="st-lab" content="on">`; experiments check this. */
export function labMode(doc: MetaSource = document): boolean {
  return metaContent(doc, "st-lab") === "on";
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

/**
 * The course a page starts on. A page made for one course (the `st-course` meta) starts there until
 * the player has chosen a course of their own; after that, their choice (switched in settings) wins.
 * A course the catalog doesn't have is ignored: the page starts as it would without the meta.
 */
export function pageStart(catalog: CatalogEntry[], settings: PlayerSettings, pageCourse: string): Start {
  const chosen = catalog.some((c) => c.id === settings.course);
  const course = pageCourse && !chosen ? catalog.find((c) => c.id === pageCourse) : undefined;
  if (course) return { ask: false, course, learner: learnerFor(course, settings.learner) };
  return chooseStart(catalog, settings);
}
