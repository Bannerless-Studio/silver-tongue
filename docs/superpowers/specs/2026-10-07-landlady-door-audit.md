# Landlady door audit and audio handoff

The current experiment gives a decodable stall card or a heard name. The opening photograph, its narration, Book entry, possession state, branch labels and tests have been removed. The unrelated later stall-family sibling reveal and the rest of act 1 retain their existing jobs.

## Action-defect audit

Every option is enumerated from the current course and compared with the lab map; extra, removed or unmapped options fail. Every site must emit a distinct immediate reaction, advance the actual core exchange, record its source option, survive reload, and display a later authored consequence. The invariant checks the stage’s visible history/directions, not just transcript storage.

| Scene | Exchanges | Replies | Alts | Silence | Total options | Verdict |
|---|---:|---:|---:|---:|---:|---|
| room-wake | 3 | 3 | 5 | 3 | 11 | PASS: every option reacts, advances, persists and has a visible end callback |
| street-hello | 2 | 2 | 4 | 2 | 8 | PASS: includes ID context beside the greeting reaction |
| stall-lead | 1 | 1 | 2 | 1 | 4 | PASS: reply/alt/silence responses retain their reactions after scene folding |
| street-introductions | 6 | 6 | 12 | 6 | 24 | PASS: every option, including the final farewell and silence |
| Total | 12 | 12 | 23 | 12 | 47 | PASS |

The complete reaction → consequence table is in [the experiment spec](2026-10-07-landlady-door-lab.md#choice-map). Consequences appear at each scene’s end. Friend reply adds a card/sign recognition route; truthful alt1 adds a name/warm-welcome route; alt2 adds an ID inquiry route; silence adds a quiet guided route. Card and heard-name rewards both provide a place to talk while Ji-woo serves.

The permutation test walks every door → Park → stall reply/alt/silence path (3,072), plus the 768 paths with a decoded card (3,840 total). Every path completes. Signatures use actual later visible text and the arrival branch, not option IDs; all signatures differ. Individual tests cover all 47 options and reload each run before the later consequence where possible. Additional tests cover pick/tiles/type modes, direct typed-slip identity and tied-input disambiguation, name audio playback, per-game partial card progress and main-page isolation.

Two display sites needed fixes: folding a completed scene hid its final reaction, and the stage’s last-direction rule hid a greeting reaction behind the next ID instruction. The lab keeps the final reaction after folding and displays all directions when an opening response is among them. Ordinary scene presentation keeps its existing rules.

## Core and lab boundary

Read core 0.19 in node_modules without edits. Accepted AltOutcome advances an alt and can carry a Korean reaction. Unaccepted alts remain on the same exchange. Core’s confused action repeats the request; tiles have no alternate-answer input. The lab configures native accepted alts on a copied course and uses English reactions. Silence and tile alternates use a valid completion input while preserving and echoing the actual option. Main-page courses and core inputs are unchanged.

All experiment runtime and storage share doorExperimentOn / labMode(). The main page never loads, clears or saves opening choices, earns a stall card, reveals its decoded place name, or uses heard-name branching. The reward paper is excluded from deskPapers; it appears in bookPapers only after the lab friendship claim. Nothing yet considers all earned/desk papers and core-kept papers.

The single DOOR_LAB_PREFIX remains silver-tongue-lab-door:. The per-game, versioned opening record stores source options, cardRead and cardAt. Legacy Boolean possession records are not loaded. Partial reward reading is per game, so another game’s course-level desk position cannot silently decode this one’s card. Saved core progress and opening records both reload in the experiment namespace.

A real merge still requires positional-save migration: map dialogue by scene/exchange ID, explicitly handling removed exchanges; map partial papers by paper line/character rather than numeric syllable position. This experiment does not implement that migration.

## Content and checker audit

No conversation line was changed in this revision. The new paper heading is 지우네, Ji-woo’s place. It matches Ji-woo’s existing stall ownership and avoids teaching 김밥 early. 지우 씨 uses the existing proper name plus already met 씨; it is spoken with existing word clips, outside the scribe exercises. The truthful arrival repeats that same key. Door exchanges still total three, with seven non-name token IDs at most. The existing all-lines checker sweep still checks exact meanings, visible fragments, negation flips and acceptance-key drift.

| Scene | Exchanges | Vocabulary verdict | Scribe verdict |
|---|---:|---|---|
| room-wake | 3 | PASS, all lines and alternatives | PASS, exact meanings / authored fragments / negation flips / live keys |
| street-hello | 2 | PASS, all lines and alternatives | PASS, exact meanings / authored fragments / negation flips / live keys |
| stall-lead | 1 | PASS, all lines and alternatives | PASS, exact meanings / authored fragments / negation flips / live keys |
| street-introductions | 6 | PASS, all lines and alternatives | PASS, exact meanings / authored fragments / negation flips / live keys |
| street-again | 3 | PASS, all lines and alternatives | Ordinary flow |
| street-what | 4 | PASS, all lines and alternatives | Ordinary flow |
| street-hungry | 6 | PASS, all lines and alternatives | Ordinary flow |
| shop-prices | 9 | PASS, all lines and alternatives | Ordinary flow |
| street-numbers | 7 | PASS, all lines and alternatives | Ordinary flow |
| shop-count | 5 | PASS, all lines and alternatives | Ordinary flow |
| stall-intro | 6 | PASS, all lines and alternatives | Ordinary flow |
| stall-shift | 7 | PASS, all lines and alternatives | Ordinary flow |
| stall-family | 3 | PASS, all lines and alternatives | Ordinary flow |
| room-rent | 6 | PASS, all lines and alternatives | Ordinary flow |
| shop-buy | 6 | PASS, all lines and alternatives | Ordinary flow |
| room-letter | 6 | PASS, all lines and alternatives | Ordinary flow |
| campus-labmate | 6 | PASS, all lines and alternatives | Ordinary flow |
| copy-intro | 6 | PASS, all lines and alternatives | Ordinary flow |
| copy-shift | 7 | PASS, all lines and alternatives | Ordinary flow |
| room-creditor | 6 | PASS, all lines and alternatives | Ordinary flow |


The full course builder reports no grammar/tagging, vocabulary-chain, reachability, audio or text-checker errors. The orchestrator supplied the card clip. Every unchanged downstream wrong-reply alternative still passes the course’s word-chain checker. groups.json needs no changes.

## New Korean text and audio

| Site | Korean | Audio status |
|---|---|---|
| papers.json, stall-card/heading | 지우네 | Present: orchestrator generated 369f1d9e66bdc341 |
| room-wake/friend truthful narration | 지우 씨. | NEW heard key; existing 지우 + 씨 word clips are played in order |
| truthful stall arrival narration | 지우 씨? | NEW repeated key; reuses those same existing word clips |

No new or changed Korean exchange/reply lines need audio in this revision. The previous corrected Park farewell clip is present. The card clip is present and the strict course-dependent tests run without audio exemptions. This worker did not generate, delete or edit audio.

## Language/content boundary audit

The scene list/styles, 47-option choice map, reward paper/place, directions and arrival branches now live in `content/settings/seoul-city/opening.json`. Ordered heard-key `audioWords` resolve to existing clips at build time; the compiled profile contains clips only. Immediate reactions and stall arrivals both play those content-declared clips. A regression replaces the declared clips with unrelated test values and checks both playback sites, detecting a renewed runtime word lookup.

Meaning acceptance fragments and exact source meanings moved from view source to `content/learner/en/scribe-ko.json`. Build-time checks reject stale acceptance keys/meanings and dangling scene, exchange, paper, message or audio-word references. The frontend contains no Korean text, language-specific word IDs or opening scene/NPC/reward IDs. The language-free guard scans all package sources for scripts, language codes/word IDs, and this setting’s scene/NPC/reward identifiers. Shared paper kinds such as `bill` are generic model values, not setting references.

All runtime and persistence sites still share the lab boundary; the main page never reads or writes opening choices or earns a card. The single experiment storage prefix remains `silver-tongue-lab-door:`. Before a real merge, positional saves still require an explicit migration by scene/exchange ID and paper line; this revision does not implement one.

## Verification

All npm/npx commands ran with `export PATH=$HOME/.local/node22/bin:$PATH` (Node 22). No lint command is configured or was run.

- `npm run typecheck`: exit 0.
- `npx vitest run tools/test/language-free.test.ts tools/test/opening-profile.test.ts packages/quiet-web/test packages/view/test/meaning.test.ts packages/view/test/scribe.test.ts packages/view/test/desk.test.ts tools/test/ko-chain.test.ts tools/test/papers.test.ts`: exit 0, 300/300 tests in 17 files, including the language-free guard, clip-source regression, checker sweep, all 47 option invariants and 3,840 permutations. Strict course/audio assertions are included.
- `npm run build:course`: sandbox blocks tsx’s IPC pipe with EPERM before building. Equivalent `node --import tsx tools/src/build-course.ts`: exit 0, all three courses compiled without checker errors; ordinary learning/gloss warnings remain.
- `npx vitest run`: exit 0, 955/955 tests in 63 files (previous orchestrator run: 946/947; eight new regression cases).
- `npx vitest run tools/test/language-free.test.ts`: exit 0, 4/4 tests.
- `npm run build:quiet`: exit 0, fresh course copied, 2,527 clips.
- `git diff --check`: exit 0.

Output tails:

```text
> typecheck
> tsc && tsc -p packages/web-common && tsc -p packages/quiet-web

Test Files  17 passed (17)
Tests       300 passed (300)

Test Files  1 passed (1)
Tests       4 passed (4)

Test Files  63 passed (63)
Tests       955 passed (955)

built packages/quiet-web/dist/index.html (200 KB) and dist/courses/ with 2527 clips

built ja-japan/en: 15 scenes
built ko-seoul/en: 20 scenes
built zh-china/en: 42 scenes
catalog: ja-japan, ko-seoul, zh-china -> dist/courses/index.json
```

## Files touched in this revision

The language-boundary follow-up adds `content/settings/seoul-city/opening.json`, `content/learner/en/scribe-ko.json`, `tools/src/opening-profile.ts` and its tests; updates `tools/src/build-course.ts`, papers validation/tests, language-free guards, view course/desk/scribe/text contracts and tests, quiet-web door-choices/main/quiet/scribe/ui/Scribe and tests, and all three experiment specs. Earlier implementation files remain listed below.


- Content: content/settings/seoul-city/papers.json; content/languages/ko/lines/stall-lead.ftl (comment only); content/learner/en/narration-seoul-city.ftl; content/learner/en/ui.ftl.
- Runtime: packages/quiet-web/src/door-choices.ts (new); main.tsx; quiet.ts; scribe.ts; notebook.ts; stage.ts; ui/Stage.tsx; ui/Overlays.tsx.
- Shared paper contract: packages/view/src/desk.ts; packages/view/src/text.ts; tools/src/papers.ts.
- Tests: packages/quiet-web/test/door-choices.test.ts (new); scribe.test.ts; storage.test.ts; notebook.test.ts; tools/test/papers.test.ts.
- Specs: this audit; 2026-10-07-landlady-door-lab.md; 2026-10-05-scribe-mode-lab.md.

## Deferred

The five-beginner attention/playability test and a manual browser playtest have not been performed. No audio is pending from this language-boundary revision. No dependencies, core changes, Chinese/Japanese source changes, commits or pushes were made.
