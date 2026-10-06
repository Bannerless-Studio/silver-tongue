# Landlady door lab experiment

The tutorial's job is to make “the world opens through something I did” happen within about three minutes for a beginner who wants to learn but struggles to focus. These are pacing targets, not measured results.

Keep the unfamiliar room, desk, Book, and the rule that comprehension reveals the story. Drop three mandatory papers, compulsory translation of both sides of every exchange, and treating one sighting as readiness to recall a word without support.

## Opening

1. Wake in the unfamiliar room. Enter can finish the crawl.
2. Sound out only the ID name, 김민준: gim, min, jun. The title, birth number, newspaper and bill remain in the Book for later reading. The narration names the discovery without deciding whose room this is.
3. Open the door. She says 민준 씨? (“Min-jun?”); answer 아니요 (“No”). New: 씨, 아니요 — two items. The decoded name is highlighted in her speech.
4. She asks 민준 씨 친구예요? (“Are you Min-jun's friend?”). Choose 네 (“Yes”) or 아니요 (“No”). New: 친구, 네, 예요 — two words and one form. Both choices advance. A friendship claim puts a photograph into your hand and Book; honesty leaves it in hers. It shows the ID face beside a woman at a food stall.
5. She asks 민준 씨 어디예요? (“Where's Min-jun?”); answer 몰라요 (“I don't know”). New: 어디, 몰라요 — two items. She points down the alley to the stall. Total at the door: six lexical items/chunks plus one form; seven token IDs besides the decoded name. All words remain glossed through this scene. The input says “What does she mean?”; the desk says “Sound it out”.
6. Outside, Park says 안녕하세요; return 안녕하세요. New: 안녕하세요 — one chunk. Show the ID; he says 민준 씨?; answer 네. New: none. He points to the same stall.
7. Go straight to the stall. Show the photograph if you have it: the woman stops serving and attends to you. Otherwise ask 민준 씨?: she answers 네 while finishing an order. New: none. Her relationship to Min-jun waits for stall-family's 동생 reveal.

Park's introduction, your name, a seat, Korean comprehension and farewells move to a return visit after the lead. They introduce the displaced words before downstream dialogue or distractors need them; rent and the rest of act 1 retain their jobs.

## Reward loop

Decoding buys recognition in the next conversation. Understanding lets the player choose a claim and discover a destination. Claiming friendship buys possession of the photograph and the woman's attention at the stall; honesty still leaves a usable name and route. The choice survives reload and stays in lab page storage. The Book retains unfinished documents and the photograph.

Acceptance belongs to scene and line IDs, with visible-word fragments and essential distinctions. Pronouns are not globally removed. Negation cannot be added or dropped. Equally matching reply slips ask for an explicit choice.

## Success test

Watch five easily distracted beginners, individually, without coaching, with permission to stop. At the door's end ask what they discovered and where they want to go next. Check whether they connect the friendship claim to photograph possession. Stop and revise the experiment if three of five cannot name the stall as where to go next. Build checks do not replace this playtest.

The return visit introduces these displaced words per exchange: `park` — 박 (name), 할아버지; `who` — 누구세요, 입니다; `ask` — 이름, 뭐, 저, 는; `sit` — 앉으세요, 감사합니다; `understand` — 한국어, 알아요; `bye` — 안녕히, 계세요, 가세요 (form of 가요). Later scenes introduce their original vocabulary; every downstream reply and distractor passes the real course word-chain checker. The full per-site verdict and new/changed Korean source-line list are in [the audit and audio handoff](2026-10-07-landlady-door-audit.md).


## Experiment boundary and saved progress

The photograph choice, its narration, possession in the Book, and the stall's photo/name response run only when the page's `labMode()` flag is on. Runtime and persistence use the same `doorExperimentOn` boundary. The non-lab page always follows the name-only path, before and after reload, and never reads or writes photograph state.

This experiment alone uses `DOOR_LAB_PREFIX` in `packages/quiet-web/src/storage.ts`: `silver-tongue-lab-door:`. Every lab session, setting, desk position, paper record, hint, counter and opening-choice record passes through this namespace. The older `silver-tongue-lab:` namespace and main-site storage are neither loaded nor changed. This isolation is for the experiment; it is not a positional-save migration.

Before a real merge, saved dialogue positions must map by scene and exchange ID, with explicit handling of removed exchanges. Partial desk progress must map by paper line and character, rather than reusing the old numeric syllable position after reordering. That migration is deferred and is not implemented here.
