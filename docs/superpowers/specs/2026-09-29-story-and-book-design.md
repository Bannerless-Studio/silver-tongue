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

Scenes, in story order (section 11): room-wake, street-hello, street-again, street-what, street-hungry, shop-prices, street-numbers, shop-count, stall-intro, stall-shift, stall-family, room-rent; shop-buy (repeatable shopping) opens beside them after shop-count.

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

## 8. Quiet page rules for book courses (2026-09-29, after the first playtest)

The quiet page's rules (2026-09-28 spec) break in the first-run regime: with every word unseen, every word is boxed and glossed, and the reading under words made a third mark for one fact. For a course with `book: true` these rules replace the gloss policy; unflagged courses keep the old rules unchanged.

- **One mark for one fact.** A word not yet *known* shows its reading under it (the Readings setting: auto / always / never). No boxes, no dotted underlines, no automatic gloss rows, no "(new)". Known words are bare.
- **Onboarding fades.** While fewer than 10 words are *met*, an NPC's line comes with the row `?` would open: the line's reading and meaning, once, dim, under the line (the meaning only with readings off). Readings under words stay readings only. From the tenth word on, that row is on demand: one tap away (word card) or one `?` away (whole line), never pushed.
- **One reading per word group.** A word and the words attached to it (a noun and its particles, a verb and its ending: `이름이`, `저는`) share one reading, their readings run together (`ireumi`), so a reading wider than one syllable never spreads a word apart. Punctuation written right after the group sits inside it. In auto the group's reading shows while any word in it isn't known yet.
- **Speaker named once.** The label shows on a scene's first NPC line and whenever the speaker changes. Consecutive lines by the same speaker carry no label. The scene's opening narration introduces a person before their label can appear.
- **`?` on the latest NPC line only.** Older lines answer to a tap on the line.
- **Reply intents** keep the existing rule (shown only when intents differ and the option holds a word not yet known).
- **Anchor row** unchanged: the one orientation element. Money and rent surface by pace only.
- **Misses** unchanged: cost on the echo, one italic line of what was asked, the request restated.
- Not translated automatically: the game's idea is that a line is understood later, not now. The onboarding window is the only concession.

## 9. Opening rules (2026-09-30)

- **The intro says only what the player can observe on waking.** No year, no rent, no names, no UI hints. Inferences (whose room, what year, what the bills are) arrive through play. The room is "The Room" until the story names it.
- **The story climbs as one block** from the bottom edge, slowly (4–6.5 s), settles, then a pulsing Press Enter; Enter is ignored while it moves. Then the name screen alone. The transcript never repeats the intro.
- Experiments deploy to the `lab` branch and show at /lab/; the main site is untouched until a screen is agreed.

## 10. Guidance and the stage-1 screen plan (2026-10-02)

Rules (user, 2026-10-02):

- **Minimal UI.** Guidance text only where the next action's what, why or how is truly unclear, and only the unclear part. Where more reduces confusion, add; where less does, remove. An instruction once acted on never repeats.
- **Natural introduction.** A need appears in the story before the lesson that answers it. Example: the clerk short-changes you, so you learn to count before it happens again.
- The Book's hotkey is `b`; while a field has focus, Tab.

Screens, in order (✓ agreed, → building, · planned):

| # | Screen | What it adds | Guidance it needs |
|---|---|---|---|
| 1 ✓ | Crawl, then name | waking, observables only | Press Enter |
| 2 ✓ | Desk | three drawn papers; one bright card labelled "read" | why: "The papers on the desk might tell you where you are." |
| 3 ✓ | Reading a paper | one block at a time; the block's letters as a sum `ㅈ j + ㅜ u = [field]`; letters met before show `?` until tapped | what: "Sound it out, one block at a time." (first paper only); how: the sum, plus a worked example on the first block only |
| 4 ✓ | After each paper | what you can now tell: a name, the year 2000, a 50,000 won bill; Enter | none |
| 5 · | The knock, landlady's first line | 민준 is bold: the player decoded it on the ID card | how to look a word up, once |
| 6 · | First reply | 네 / 아니요 with reading and meaning this once | none |
| 7 · | Rest of room-wake | no top lines; meanings fade as words are heard | none |
| 8 · | Alone, hungry, ₩20,000 | one exit: go outside | why only: hunger |
| 9 · | Shop before numbers | hold out a note, hear a price you can't parse, get change you can't check | none: the confusion is the point |
| 10 · | Grandpa Park on the bench | he saw it; counts the coins in your hand; numbers lesson | the story is the why |
| 11 · | Shop again | count your change right; the clerk's trust | none |
| 12 · | Hungry → the stall | Ji-woo, work, the photo | as before |

Scene order as built (section 11): room-wake → street-hello → street-again → street-what → street-hungry → shop-prices → street-numbers → shop-count → stall-intro. The shop comes before the numbers, so the numbers arrive with a reason. Screens 8–9 differ: Grandpa Park comes first (greet, ask him to slow down, ask what things are), then hunger sends you to the shop.

## 11. Stage-1 scene chain (as built, 2026-10-02)

Rule (user): each scene exists because of something the learner wants to do next, and the story gives the reason before the lesson. Each scene's `after` is the one before it, so a new player meets them in this order and every reply and written wrong reply uses only words met earlier in the chain. Desk papers come first (민준 is readable before the knock).

| # | Scene | Learner wants | Story reason (observable) | New words |
|---|---|---|---|---|
| 1 | room-wake | answer when spoken to: yes, no, who, I am | the landlady knocks for Min-jun; pinned "민준 씨 친구예요?" | 민준 Min-jun, 씨 Mr/Ms, 네 yes, 친구 friend, 이에요/예요/입니다 is, 아니요 no, 여기 here, 방 room, 누구 who, 저 I, 는 (topic), 안녕히 in peace, 계세요 stay, 가세요 go |
| 2 | street-hello | greet, thank, give a name | outside, the old man on the bench speaks to you | 안녕하세요 hello, 박 Park, 할아버지 grandfather, 이름 name, 이 (subject), 뭐 what, 앉으세요 sit, 감사합니다 thank you, 한국어 Korean, 알아요 know, 몰라요 don't know |
| 3 | street-again | "sorry?", "again", "slowly" | he asks something fast; you catch nothing until you ask him to slow down | 어디 where, 다시 again, 말해 (주세요) say, 주세요 please, 천천히 slowly |
| 4 | street-what | "what is this?", this / that | he taps the book in your hand; you ask about his newspaper and the shop across the alley | 이거 this, 책 book, 좋아요 good, 신문 newspaper, 저거 that, 가게 shop |
| 5 | street-hungry | say what you need; ask where | your stomach growls; he asks if you have bread, points: shop here, stall over there | 배고파요 hungry, 빵 bread, 있어요 there is, 없어요 there isn't, 에 at, 저기 over there, 분식집 snack stall |
| 6 | shop-prices | buy by pointing: "this, please", "how much?" | bread and milk; the clerk rattles off prices; one note comes back from your five-thousand | 어서 오세요 welcome, 우유 milk, 도 too, 천 thousand, 원 won, 얼마 how much |
| 7 | street-numbers | count | Grandpa Park waits outside the shop, holds up your one note, counts three on his fingers | 하나 둘 셋 넷 다섯 one–five, 삼 three (Sino) |
| 8 | shop-count | say an amount, count change | back at the shop with the one note: you say 삼천 원; he counts two more into your hand and says sorry | 미안해요 sorry, 괜찮아요 it's all right |
| 9 | stall-intro | names, "tasty", take a job | Ji-woo runs the stall alone with customers waiting; she feeds you, hands you an apron | 지우 Ji-woo, 떡볶이 tteokbokki, 먹어요 eat, 맛있어요 tasty, 같이 together, 일해요 work |
| 10 | stall-shift (repeatable) | numbers at work | she calls orders; you bring them; pay | 김밥 gimbap, 어묵 fish cake, 그릇 bowl, 줄 roll, 개 (counter) |
| 11 | stall-family | family words | the photo; pinned "동생이에요. 지금 없어요." | 봐요 look, 사진 photo, 동생 younger sibling, 지금 now, 을 (object) |
| 12 | room-rent | until, month, how often | the landlady with a ledger; pinned "민준 씨는 삼월까지 냈어요." | 방세 rent, 냈어요 paid, 오 five (Sino), 만 ten thousand, 일주일 week, 월 month, 까지 until |
| — | shop-buy (repeatable, after shop-count) | buy food, count change | shopping between shifts; change counted every time | 사 four (Sino) |

Deviations from the brief's table, with reasons:

- **Short change is narration, not money.** shop-prices costs nothing and shop-count pays nothing. Any cost before the first paid job can lock the story for a player whose wallet has run down (a scene with a cost is unavailable when the wallet is short, and nothing earns before the stall), so no story scene before stall-shift costs money. `tools/test/ko-chain.test.ts` pins this.
- **shop-count (new, one-off) replaces shop-buy as step 8.** shop-buy is repeatable and costs ₩1,000, so gating the stall on it was a dead end (the bots stalled there). shop-count is the confrontation; shop-buy stays as repeatable shopping after it.
- **Change sums use only 1, 3, 4, 5.** Sino 2 (이) is spelled like the subject marker 이 and the lexicon rejects two words with one spelling: no price says 이천. Bread and milk are ₩1,000 each, paid with ₩5,000; the clerk returns ₩1,000 instead of ₩3,000.
- **No "when" (언제) in room-rent.** The scene already introduces seven words; "when" waits for stage 2.
- **Mentor notes:** "이에요 and 예요" now triggers on street-what (책이에요 / 가게예요).
- **Wrong replies always look wrong.** A miss repeats the line slower, so no written wrong reply may be a reply its scene takes as right, or a request to hear the line again (네? / 다시 / 천천히 말해 주세요): either gets what looks like an answer and can be picked forever. In street-again each right reply changes his line (어디 가요? → 어디 가요? 어디? → 네, 네. 어디 가요? → 어디…… 가요?), so progress differs from a miss. `tools/test/ko-chain.test.ts` pins both.
- **No "tomorrow" at the stall.** The shift opens as soon as stall-intro ends, today or the next day depending on the slots left, so Ji-woo asks 같이 일해요? ("work together?") and the scene ends on the apron, with no goodbye.

## 12. The conversation stage (2026-10-02)

Book courses only (`bookOn`); zh/ja keep the transcript. The conversation is a stage, not a log: one utterance is on it at a time, everything earlier is small history above it, and what you can say comes from your book (paper slips) at the bottom.

**Materials.** Their world is bright text on the dark page with a thin rule at the left in the speaker's colour. Everything of yours is paper, the desk cards' paper and ink: reply slips, your said line, tile pieces, the word card. Paper means *say*. The cyan outline means *do* (open the door, go outside, sleep). Nothing else is boxed.

**Tokens** (`quiet.css`, `.book` scope):

| token | value | use |
|---|---|---|
| `--paper` | `#e8e1cf` | slips, said line, tiles, word card |
| `--ink` | `#2a2620` | text on paper |
| `--ink-2` | `#6e6658` | readings and meanings on paper |
| `--who-0..3` | `#8fb6d9` slate blue, `#d9a86c` ochre, `#9fc58d` sage, `#c9a0c8` heather | speaker rule and name, by the NPC's order in the setting's `world.npcs` (not by id) |
| `--fs-xs / sm / md / lg / xl` | 12 / 13.5 / 15 / 21 / 30px (xl 28px under 560px) | tags, history+narration, meaning, slip Korean, the line on stage |
| `--ko` | the system UI face (`system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`) | all Korean; no web fonts (a serif face changes ㅈ/ㅊ/ㅎ) |

Readings stay in the page mono; meanings and narration in the page font.

**Layout** (top to bottom): anchor row; history (a band of fixed height that scrolls, newest at its foot; shrinks first when space is short); the stage (stage direction row of reserved height, speaker name row of reserved height, the line, your said line); the reply area pinned above the footer. The line's position depends only on the band above it, so it never jumps when lines change.

**States.**
- *Scene start*: the scene's opening narration alone on the stage (centred, upright, small, muted); after ~1.2 s the first line comes in.
- *Their line*: speaker name (first line of a scene, or on change), the line large (semibold), readings under word groups (ruby rules unchanged), the meaning muted under it while onboarding, `?` beside it after; the one-time look-up hint under the first line.
- *Replies*: slips right-aligned in one column of equal width; rows Korean / reading / meaning, every slip with the same rows (reading row when any slip has one, meaning row while onboarding or when any slip holds a word not heard yet: the meaning while onboarding, the intent after, the meaning where a reply has no intent). Number hints only with a keyboard, outside the slip. "… say nothing" is a quiet text control under the slips.
- *Picked*: the slip becomes your said line (paper, compact, right, under their line), the other slips go; ~1.1 s later their answer replaces the stage and the pair moves to history. Any key or tap ends the wait early.
- *Miss*: your slip is laid down as said; their reaction small under it; the request stays as the line, pulses once and carries the tag "again, slower" (or "again" when rephrased); the slip you tried goes back to the stack faded and last. A second miss replaces the said line and reaction; nothing stacks.
- *Word look-up*: a small paper card anchored under the word: word, reading, meaning, play. Any tap elsewhere closes it.
- *Tiles*: paper pieces at the bottom; the sentence being built sits where your said line goes, with ⌫ and ✓ beside it; the one-time hint sits over the tile row, aligned with it.
- *Scene end*: speech clears; the end narration sits centred on the stage; one cyan control at the bottom, the rest on one quiet row (primaryItem unchanged).
- *History*: one line per utterance: their lines left with the speaker's rule, yours right on paper, Korean only; narration and finished scenes small and dim. A tap opens a line's reading and meaning and plays it again. Missed replies don't enter history.

**Motion.** ≤300 ms, transform and opacity only: the line rises in, the said line slides up from the slips, a repeat pulses once. None under `prefers-reduced-motion`.

Also in this pass: the rent row stays off the anchor until the scene that raises rent (`rent: true` on the scene, room-rent) is done; the room-rent title says what is seen ("See what the landlady wants"); the Papers tab shows a clue line whole in Hangul with its reading row under it.
