import { useEffect, useState } from "preact/hooks";
import type { CatalogEntry, WordId } from "@silver-tongue/core";
import type { SpeechSpeed } from "@silver-tongue/view";
import type { Art } from "../art";
import { keyAction } from "../keys";
import type { Vn } from "../vn";
import { Box } from "./Box";
import { Card, type CardData } from "./Card";
import { DayFade } from "./DayFade";
import { Hud } from "./Hud";
import { Backlog, Games, Menu, Notebook } from "./Overlays";
import { PlaceMenu } from "./PlaceMenu";
import { Replies } from "./Replies";
import { RotateHint } from "./RotateHint";
import { Stage } from "./Stage";
import { Tiles } from "./Tiles";
import { TypeReply } from "./TypeReply";
import { Toasts } from "./Toasts";
import { useVn } from "./use-vn";

export interface Page {
  catalog: CatalogEntry[];
  /** the course has sound this browser can play */
  audioAvailable: boolean;
  /** the player's speed and auto-advance choices, already resolved */
  prefs: { speed: SpeechSpeed; autoAdvance: boolean };
  setPref(patch: Partial<Page["prefs"]>): void;
  switchTo(course: string, learner: string): void;
  games: {
    list(): { id: string; label: string }[];
    open(id: string): void;
    startNew(): void;
    exportLine(): Promise<string>;
    importLine(line: string): Promise<string | null>;
  };
  textUrl: string;
  quietUrl: string;
}

type Overlay = "notebook" | "backlog" | "menu" | "games" | null;

export function App({ vn, art, page }: { vn: Vn; art: Art; page: Page }) {
  const view = useVn(vn);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const onWord = (w: WordId) => setCard({ kind: "word", card: vn.lookUp(w) });
  const onMeaning = () => {
    const c = vn.sentence();
    if (c) setCard({ kind: "sentence", card: c });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const a = keyAction(e.key, { overlay: !!overlay || !!card, phase: vn.view().phase.kind, typing, modifier: e.ctrlKey || e.altKey || e.metaKey });
      if (!a) return;
      e.preventDefault();
      const p = vn.view().phase;
      if (a.kind === "close") (card ? setCard(null) : setOverlay(null));
      else if (a.kind === "advance") vn.advance();
      else if (a.kind === "choose") (p.kind === "tiles" ? vn.placeTile(a.n) : vn.choose(a.n));
      else if (a.kind === "undo") vn.undoTile();
      else if (a.kind === "send") vn.sendTiles();
      else if (a.kind === "open") setOverlay(a.overlay === "settings" ? "menu" : a.overlay);
      else if (a.kind === "sound") vn.toggleSound();
      else if (a.kind === "replay") vn.replay();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [vn, overlay, card]);

  // The scene waits for the player while a notebook, a card or another tab has their attention.
  // Each of those re-runs this effect, which syncs the hold again, so the cleanup has none to give back.
  useEffect(() => {
    const held = () => !!overlay || !!card || document.hidden;
    const sync = () => vn.hold(held());
    sync();
    addEventListener("visibilitychange", sync);
    return () => removeEventListener("visibilitychange", sync);
  }, [vn, overlay, card]);

  // Only when this controller is the one going away, so closing an overlay does not stop the game:
  // a stopped controller never arms its timer again, and the old one's dwell would tick on over
  // the game that replaced it, on the audio they share.
  useEffect(() => () => vn.stop(), [vn]);

  return (
    <div class="stage">
      <Stage vn={vn} view={view} art={art} />
      <Hud vn={vn} view={view} onOpen={setOverlay} />
      <PlaceMenu vn={vn} view={view} />
      <Replies vn={vn} view={view} onWord={onWord} />
      <Tiles vn={vn} view={view} />
      <TypeReply vn={vn} view={view} />
      <Box vn={vn} view={view} onWord={onWord} onMeaning={onMeaning} />
      <Toasts vn={vn} view={view} />
      <DayFade vn={vn} view={view} />
      {overlay === "notebook" && <Notebook vn={vn} onClose={() => setOverlay(null)} />}
      {overlay === "backlog" && <Backlog vn={vn} view={view} onClose={() => setOverlay(null)} />}
      {overlay === "menu" && <Menu vn={vn} page={page} onClose={() => setOverlay(null)} onGames={() => setOverlay("games")} />}
      {overlay === "games" && <Games vn={vn} page={page} onClose={() => setOverlay(null)} />}
      {card && <Card vn={vn} data={card} onClose={() => setCard(null)} />}
      <RotateHint t={vn.t} />
    </div>
  );
}
