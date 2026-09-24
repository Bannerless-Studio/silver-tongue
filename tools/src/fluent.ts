import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";
import { FluentParser, FluentSerializer, Identifier, Message, Resource, Term } from "@fluent/syntax";

const parser = new FluentParser({ withSpans: false });

/** Parses Fluent source, failing on any syntax error. */
export function parseFtl(src: string, name: string): Resource {
  const res = parser.parse(src);
  const junk = res.body.find((e) => e.type === "Junk");
  if (junk) throw new Error(`${name}: Fluent syntax error near: ${JSON.stringify((junk as { content: string }).content.slice(0, 60))}`);
  return res;
}

export function termNames(src: string, name: string): string[] {
  return parseFtl(src, name).body.filter((e): e is Term => e instanceof Term).map((t) => t.id.name);
}

export function messageIds(src: string, name: string): string[] {
  return parseFtl(src, name).body.filter((e): e is Message => e instanceof Message).map((m) => m.id.name);
}

/**
 * Slot binding: for each slot, defines a term named after the slot as a copy
 * of the chosen concept's term, so lines can say { -item } or { -item(form: "measure") }.
 */
export function bindSlots(termsSrc: string, combo: Record<string, string>): string {
  const terms = new Map(
    parseFtl(termsSrc, "terms.ftl")
      .body.filter((e): e is Term => e instanceof Term)
      .map((t) => [t.id.name, t]),
  );
  const aliases = Object.entries(combo).map(([slot, concept]) => {
    const term = terms.get(concept);
    if (!term) throw new Error(`terms.ftl has no term -${concept}`);
    const copy = term.clone();
    copy.id = new Identifier(slot);
    copy.comment = null;
    return copy;
  });
  return new FluentSerializer().serialize(new Resource(aliases));
}

export class Renderer {
  private bundle: FluentBundle;

  constructor(locale: string, sources: string[]) {
    this.bundle = new FluentBundle(locale, { useIsolating: false });
    for (const src of sources) {
      const errors = this.bundle.addResource(new FluentResource(src), { allowOverrides: true });
      if (errors.length) throw errors[0];
    }
  }

  has(id: string): boolean {
    return !!this.bundle.getMessage(id)?.value;
  }

  render(id: string, args: Record<string, FluentVariable> = {}): string {
    const msg = this.bundle.getMessage(id);
    if (!msg?.value) throw new Error(`missing message "${id}"`);
    const errors: Error[] = [];
    const out = this.bundle.formatPattern(msg.value, args, errors);
    if (errors.length) throw new Error(`message "${id}": ${errors[0].message}`);
    return out;
  }
}
