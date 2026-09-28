import { useEffect } from "preact/hooks";
import type { Quiet, QuietView, Toast } from "../quiet";

function Item({ q, toast }: { q: Quiet; toast: Toast }) {
  useEffect(() => {
    const h = setTimeout(() => q.dismissToast(toast.id), 4000);
    return () => clearTimeout(h);
  }, [toast.id]);
  return <button type="button" class={`toast ${toast.tone}`} role="status" onClick={() => q.dismissToast(toast.id)}>{toast.text}</button>;
}

/** Brief news: a new rank, a new scene, a rejected input. Gone in a few seconds. */
export function Toasts({ q, view }: { q: Quiet; view: QuietView }) {
  if (!view.toasts.length) return null;
  return <div class="toasts">{view.toasts.map((x) => <Item key={x.id} q={q} toast={x} />)}</div>;
}
