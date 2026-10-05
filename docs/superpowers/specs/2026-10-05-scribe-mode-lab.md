# Scribe mode (lab only)

On the lab page only, the first two Korean conversations (`room-wake`, `street-hello`) are played by typing meanings.
Everywhere else (the main site, later scenes) the stage is unchanged. Switch: `scribeOn` in `packages/quiet-web/src/scribe.ts`
(lab page meta `st-lab`, a course with the desk, a scene in `SCRIBE_SCENES`). Rules: `packages/view/src/scribe.ts`, `meaning.ts`. Page: `packages/quiet-web/src/ui/Scribe.tsx`.

- **Their line** shows in Latin letters (the desk's `romanize`, per word so a tap opens the word card). A field asks for its meaning.
  Right: the meaning stays under the line and the reply slips appear. Wrong: the field shakes.
- **Your reply**: slips are Latin only and not tappable. One field takes the meaning of the reply you want; the closest slip is said (`q.choose`).
  Number keys never say a reply here.
- **Layout**: the reply block (slips, field, `? help`, `… say nothing`) is drawn by the stage itself, right under their line and its
  meaning, right-aligned on the player's side like a said line. It is not in the pinned `.replies` strip, so there is no gap and the
  conversation reads downward. Narrow screens use the same column (`.slips` is `min(100%, 21rem)`).
- **First-time glosses** (help first, hands off later): on their line and on every reply slip, a word the player has never met shows its
  short gloss under the romanised word (`.sw-g`); a met word shows nothing until help asks. "Met" is core's word record (`first`):
  `freshOnTheirLine` (a word whose first line is this one and not yet got right; core marks a line's words when it is heard) and
  `freshOnReply` (no `first`: core records a reply's words only when it is said). So "Nuguseyo?" is glossed while it is a slip and bare on
  the next exchange. The set is worked out once per exchange (`freshOnce`), so words do not turn bare mid-exchange. The first help press
  still glosses every word of their line.
- **Help** (button, or typing `?`): on their line first the words' glosses, then the whole meaning; on the reply, each slip's meaning.
  It lights after `scribeHelpAfter(index)` misses: 1 for the first two exchanges a course has begun, 3 after. Only the very first exchange shows a worked example.
  The count is kept per course in localStorage (`scribeCountKey`).
- **Matching** (`meaningMatches`): case, accents, punctuation, contractions, `thanks`/`bye`/`hi` and small words do not matter; every content word of the
  meaning must be typed, up to two more are allowed, and a negation is never added or dropped. Other ways to say a line go in `SCRIBE_ACCEPTS`
  (keyed by meaning): core's rendered lines have no field for them, so `<id>-accept` in the learner `.ftl` cannot reach the page.
- Known limits: earlier lines in the history turn back to Hangul when the scene ends; a scribe scene replayed in tiles mode keeps the normal tiles.
