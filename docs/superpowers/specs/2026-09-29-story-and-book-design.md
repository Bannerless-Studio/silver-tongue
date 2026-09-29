# Story and the Book (2026-09-29)

2026-09-29 · approved in conversation; ko-seoul slice 1, ruby and the Book are being built

## 1. Premise

Exploratory: built for the Korean course only, gated behind the `book` pack flag. The zh and ja courses keep their premise and UI until parts of this are judged worth adopting.

The player fell asleep over a textbook of the language and woke, in the setting's city and year, in the rented room of a student who has vanished. On the desk: his ID card, unpaid bills. Nobody can translate for the player.

The in-game Book (hotkey `n`) is that textbook in fiction. Letters = its alphabet pages. Words = margin notes. Papers = things tucked inside it.

First course on it: `ko-seoul`, Seoul 2000, post-IMF.

- Student: 민준 Kim Min-jun, physics.
- Sister: 지우 Ji-woo, runs a 분식 stall.
- Landlady: rents the room.
- Old man on the bench: the mentor.
- Shop clerk: short-changes the player.

## 2. The arc

Four acts on four stages (TOPIK 1–4; HSK 1–4 / JLPT N5–N2 for the other packs).

| Stage / level | Act | Word themes the level teaches anyway | Story beats carried by those words | Key NPC whose trust opens the next district |
|---|---|---|---|---|
| 1 A1 | Survival | greetings, numbers, money, food, places, family, days/time, like/want | rent, work, eat; sister's stall; family-photo scene ("younger brother, away"); landlady "paid until March"; clerk cheats you on change; three buried lines in stage-1 words | sister |
| 2 A2 | Accidental investigation | past tense, dates, letters/post, phone, directions, jobs, university, illness, borrow/owe, weather | university district; mail addressed to him (first reading scenes); creditor at the door; lab-mate "stopped coming in March, took the notes"; the Book now glosses the sister's stage-1 line | lab-mate |
| 3 B1 | The student | reason, decide, believe, choose, plan, future, leave, responsibility, opinion, reported speech | his journal becomes readable; professor scene; selection rule "someone holding a Korean book"; the sister knew he planned to leave; confrontation scene, reply choices differ in trust cost, none is "forgive" | professor, sister |
| 4 B2 | The truth, home | conditionals, regret, hypotheticals, abstract vocabulary, formal register | one letter he left "for whoever comes"; lab-mate finds the way back; farewell dialogues; choice go/stay, both endings are conversations | lab-mate |

Rules:

- Every clue is spoken in the stage it belongs to, in that stage's words. Nothing is withheld by plot, only by comprehension.
- Reading (letters, journal) is the Act 2+ channel.
- The antagonist gets one letter of screen time.
- The sister carries "understanding without forgiving".
- The premise could port to zh/ja unchanged (settings as skins); not decided.

## 3. Stage 1 slice (ko-seoul, being built)

Scenes: room-wake, street-hello, street-numbers, street-hungry, stall-intro, stall-shift, stall-family, room-rent, shop-prices, shop-buy.

Pinned clue lines:

- Landlady, room-wake: "민준 씨 친구예요?"
- Landlady, room-rent: "민준 씨는 삼월까지 냈어요."
- Ji-woo, stall-family: "동생이에요. 지금 없어요."

Success test: three playtesters reach stall-family. If none asks who the brother is, the buried-clue device failed and Act 2 needs an explicit trigger.

## 4. UI/UX decisions

No story screen.

- **(a) Ruby.** Lines are shown in script from line one. Romanisation (ruby) sits under each word until that word is *known*, then drops. Setting: auto / on / off. `[s]` still shows the whole line.
- **(b) The Book.** Tabs: Letters · Words · Papers · Notes. Papers lists pinned lines the player has heard, each with a bar of known/total words. Opening one shows unknown words blanked (reading, dim). A full bar lights once on the HUD, the only push the game makes. Documents (stage 2+) are objects in the room, opened as reading scenes.
- **(c) Stage gates** say only who trusts you and what road opened.
- **(d) Confrontation and ending** are ordinary scenes. The ending choice is one reply pair.
- **(e) Tile preview for spaced languages** is modelled as `spaced: false`: `attach` words glue to the previous tile, `tileGap` between the rest.

## 5. Approved follow-ups (not yet built)

1. **Guessed glosses.** On a Papers line the player can type their own gloss for a blank. It is kept until the word is known, then shown beside the truth. Rationale: generation effect; the investigation becomes something the player did.
2. **Reply latency as signal.** Slow-correct stays *met*, not *known*. Needs core; until then log it front-end side for tuning. Plus a social hard timer per reply, front-end only: ~8 s NPC nudge, ~15 s rephrase (existing event), ~25 s give-up = a miss in work scenes (pay halves), a `confused` in conversations. No visible countdown; a setting lengthens or disables it. Rationale: hesitation is evidence of weak recall, and real conversation has a clock.
3. **Wrong replies as content.** Specific alts get their own scripted NPC reply and the scene branches (say 네 to "Min-jun's friend?" and she asks where he is; accept the clerk's price and he pockets it). Needs per-alt reactions in core (today reactions are per slot group). Do clerk and landlady first. Rationale: failure is content, and mistakes teach through consequence.
4. **Visible decay.** On return, one day-start line names words that slipped, and Book bars stay honest. Core already decays; this only shows it. Rationale: forgetting is real, so show it.

## 6. Decided against (do not build)

- The design spec's "district opens when every stage word is met and trust with key NPCs reaches a threshold" rule. Core never implemented it; scene `after` and `requires.trust` gate everything. Deleted from the design spec.
- Quest log, timeline, clue board, relationship numbers.
- Any run-level real-time clock before Act 4.
- Rank label and stage progress stay; the raw percentage is hidden.

## 7. Lessons borrowed

- Heaven's Vault: guesses stay wrong until contradicted.
- Chants of Sennaar: validation is a moment.
- Obra Dinn: the book is the interface.
- Papers Please: day loop, one line of consequence.
- Roadwarden: irreversible days, count always visible.
- Disco Elysium: failure is content.
- Persona: slots and trust; never show the number.
- Prince of Persia: the clock punishes waste, not slowness.
