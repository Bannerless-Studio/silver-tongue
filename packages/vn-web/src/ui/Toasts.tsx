import { useEffect } from "preact/hooks";
import type { Toast } from "../vn";
import type { Vn, VnView } from "../vn";

function Item({ vn, toast }: { vn: Vn; toast: Toast }) {
  useEffect(() => {
    const h = setTimeout(() => vn.dismissToast(toast.id), 4000);
    return () => clearTimeout(h);
  }, [toast.id]);
  return <div class={`toast ${toast.tone}`} role="status" onClick={() => vn.dismissToast(toast.id)}>{toast.text}</div>;
}

export function Toasts({ vn, view }: { vn: Vn; view: VnView }) {
  return <div class="toasts">{view.toasts.map((x) => <Item key={x.id} vn={vn} toast={x} />)}</div>;
}
