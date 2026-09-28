import { useEffect, useState } from "preact/hooks";
import type { Quiet, QuietView } from "../quiet";

/** The controller's view, re-read whenever it changes. */
export function useQuiet(q: Quiet): QuietView {
  const [view, setView] = useState(() => q.view());
  useEffect(() => {
    setView(q.view());
    return q.subscribe(() => setView(q.view()));
  }, [q]);
  return view;
}
