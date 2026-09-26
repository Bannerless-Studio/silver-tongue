import { useEffect, useState } from "preact/hooks";
import type { Vn, VnView } from "../vn";

/** The controller's view, re-read whenever it changes. */
export function useVn(vn: Vn): VnView {
  const [view, setView] = useState(() => vn.view());
  useEffect(() => {
    setView(vn.view());
    return vn.subscribe(() => setView(vn.view()));
  }, [vn]);
  return view;
}
