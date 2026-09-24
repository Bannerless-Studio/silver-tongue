import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";
import {
  FluentParser,
  FluentSerializer,
  Identifier,
  Message,
  Resource,
  SelectExpression,
  StringLiteral,
  Term,
  TermReference,
  VariableReference,
  Visitor,
  type Placeable,
} from "@fluent/syntax";

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

/** The variant keys a term chooses between with `$form`; empty when it has no forms. */
function formsOf(term: Term): string[] {
  const select = term.value.elements
    .map((e) => (e as Placeable).expression)
    .find((x): x is SelectExpression => x instanceof SelectExpression && x.selector instanceof VariableReference && x.selector.id.name === "form");
  return select ? select.variants.map((v) => (v.key instanceof Identifier ? v.key.name : v.key.value)) : [];
}

/** Every `-term(form: "...")` in the source, with the term name and the form asked for. */
function formRefs(src: string, name: string): { term: string; form: string }[] {
  const refs: { term: string; form: string }[] = [];
  class Collect extends Visitor {
    visitTermReference(node: TermReference) {
      const form = node.arguments?.named.find((a) => a.name.name === "form")?.value;
      if (form instanceof StringLiteral) refs.push({ term: node.id.name, form: form.value });
      this.genericVisit(node);
    }
  }
  new Collect().visit(parseFtl(src, name));
  return refs;
}

/**
 * Slot binding: for each slot, defines a term named after the slot as a copy
 * of the chosen concept's term, so lines can say { -item } or { -item(form: "measure") }.
 * Throws if a slot name is already a term, or if the lines ask a term for a form it doesn't have
 * (Fluent would quietly fall back to the default form).
 */
export function bindSlots(termsSrc: string, combo: Record<string, string>, linesSrc: string, linesName: string): string {
  const terms = new Map(
    parseFtl(termsSrc, "terms.ftl")
      .body.filter((e): e is Term => e instanceof Term)
      .map((t) => [t.id.name, t]),
  );
  const aliases = Object.entries(combo).map(([slot, concept]) => {
    if (terms.has(slot)) throw new Error(`slot "${slot}" has the same name as the term -${slot}`);
    const term = terms.get(concept);
    if (!term) throw new Error(`terms.ftl has no term -${concept}`);
    const copy = term.clone();
    copy.id = new Identifier(slot);
    copy.comment = null;
    return copy;
  });
  for (const { term, form } of formRefs(linesSrc, linesName)) {
    const target = terms.get(combo[term] ?? term);
    if (target && !formsOf(target).includes(form)) {
      const shown = term in combo ? `-${term} (-${combo[term]})` : `-${term}`;
      throw new Error(`${linesName}: ${shown} has no form "${form}"`);
    }
  }
  return new FluentSerializer().serialize(new Resource(aliases));
}

/** A Fluent source and the name its errors are reported under. */
export type FtlSource = [name: string, src: string];

export class Renderer {
  private bundle: FluentBundle;

  /** Throws on a syntax error, or if two sources define the same message or term. */
  constructor(locale: string, sources: FtlSource[]) {
    this.bundle = new FluentBundle(locale, { useIsolating: false });
    for (const [name, src] of sources) {
      parseFtl(src, name);
      const errors = this.bundle.addResource(new FluentResource(src));
      if (errors.length) throw new Error(`${name}: ${errors[0].message}`);
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
