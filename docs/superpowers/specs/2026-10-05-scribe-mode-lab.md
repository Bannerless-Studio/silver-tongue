# Scribe mode (lab only)

The lab's Korean opening uses `room-wake`, `street-hello`, `stall-lead`, and the later return visit `street-introductions` (`SCRIBE_SCENES`). Other pages and scenes keep the ordinary conversation flow. The lab switch also requires a course with desk papers.

Their line stays in Korean, using the shared `Line` renderer and `soundedTokens` to highlight the name decoded on the desk. Romanisation appears beneath it. The player types a rough meaning; success leaves the meaning visible and reveals replies. At the door the field says “What does she mean?”; the desk still says “Sound it out”.

At the door, all words remain glossed through all three exchanges, including reply vocabulary. The player selects a Korean slip with its introduced meaning and intent. Both friendship replies advance; their consequences differ. Later scribe scenes retain the meaning input for replies and their existing freshness/help policy.

Both matching paths use authored scene-and-line acceptance rules in `packages/view/src/scribe.ts`. Rules include visible-word fragments and retain the current English meaning for a drift assertion. Pronouns are not globally discarded. Adding or dropping negation rejects a match. All scribe lines, replies and distractors are swept for exact meanings, every authored fragment, negation flips, and stale/missing keys.

Typed replies with equally best matches prompt “Which reply do you mean? Choose one.” Only the tied slips are selectable there; input never picks the first match. Ties belong to the current exchange's Round so they cannot leak into the next one. Name-bearing reply lookup compares personalised text and intent rather than guessing from English phrasing.

Help remains available by button or `?`. The first press reveals glosses, then the meaning; reply help reveals meanings. Its existing miss-count arc and first worked example remain. Number keys do not bypass scribe input. Replay in tiles mode keeps normal tiles.

The photograph choice uses a narrow per-saved-game record through the door experiment’s separate lab storage namespace (`DOOR_LAB_PREFIX`). Runtime photo handling, narration, Book display and stall branching share the `labMode()` boundary with persistence; non-lab play follows the name-only path without photo state. Core 0.19 supports accepted alternate replies, but only keeps their outcomes in the current run and five recent talks; it has no durable inventory flag. The Book shows the photograph when possessed, and retains every desk document, including unfinished lines, for later reading.

Experiment and beginner success test: [landlady door lab](2026-10-07-landlady-door-lab.md).
