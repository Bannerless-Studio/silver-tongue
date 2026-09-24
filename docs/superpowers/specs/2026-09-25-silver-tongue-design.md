# Silver Tongue — Design

2026-09-25 · status: draft for review

> You arrive speaking pidgin; you leave with a silver tongue.

## Summary

Silver Tongue is a language-learning life game. The player arrives in a foreign city knowing a few words and has to earn a living there. Every job, purchase and conversation happens in the language being learned. Understanding people earns money and trust. Money pays for living, and trust opens better jobs and new people.

The engine is **language-agnostic**. Four things come from content, not code:

| Axis | Example | Lives in |
|---|---|---|
| Language being learned | Mandarin | language pack |
| Learner's own language (glosses, UI, narration, mentor) | English, later Bengali | learner-language files |
| Setting (city, places, jobs, currency, prices) | a Chinese city street | setting pack |
| Level system and stages | HSK 1–4, CEFR A1–B2, JLPT | language pack |

A **course** is one combination of the three: language + setting + learner language (e.g. `zh-china-en`).

There are two front ends on one shared core:

- **3D game:** three.js, WASD movement with an orbiting camera, and a touch joystick on phones.
- **Text game:** a TUI that plays in a real terminal (`npx silver-tongue`) and in the browser through xterm.js, from one codebase.

The first course is Mandarin (HSK) in a Chinese city, with English as the learner language.

## Design principles

1. **Language is the mechanic.** Progress depends on understanding. There are no quiz screens bolted onto a walking game.
2. **Failure is cheap and funny.** The NPC does what you actually said. The cost is a few coins or a day slot. There is never a game over.
3. **About 90% known words.** Each exchange introduces at most 2 new words.
4. **Audio first.** The NPC speaks, then the text appears. Pronunciation and gloss are one tap (or key) away, and using that help is logged.
5. **Hidden repetition.** Weak words come back inside later scenes. The player never sees a review queue.
6. **Nuance after experience.** The mentor explains a usage point only after the player has run into it.
7. **Scripted content, checked at build time.** There is no live LLM. Every line is tagged and level-checked before it ships.
8. **Time moves in day slots,** not a real-time clock.
9. **Grey boxes before art.**

## Game mechanism

### The loop

1. **A day** has an ordered list of action slots (4 by default; set in the setting pack). A job shift, an errand or an evening visit uses one slot. Sleeping ends the day. Each slot has an optional label (`morning`, `noon`, …) that is ignored for now. It is there so days can later be split into named parts without a redesign.
2. **An exchange:** the NPC's line plays (audio, then text). The player replies in the mode the engine picks (see *Reply modes*).
3. **Outcome:** every reply is an **action with parameters** (`serve {item: tea, count: 4}`). The world carries it out as said. If it differs from what the NPC expected, the NPC reacts with a reusable reaction chosen by what differed (`wrong-count`, `wrong-item`, `wrong-place`, falling back to `wrong-generic`). The player pays a small cost and retries.
4. **Rephrase:** after two misses on the same exchange, the NPC uses the line's authored rephrase if there is one. If not, the line is replayed slowly with pronunciation shown. Nobody gets stuck.
5. **Stakes:** a completed shift pays wages, and mix-ups reduce the pay. A finished scene raises **trust** with that NPC.

### Money and trust

| | Money | Trust (per NPC) |
|---|---|---|
| Earned by | wages for completed tasks | completing scenes with that NPC; bigger gains for fewer mix-ups |
| Spent on / opens | rent (weekly), food (daily), items that open jobs (e.g. a bike for deliveries) | that NPC's better jobs; introductions to new NPCs |
| Lost by | mix-ups (1–5 units) | nothing (trust never goes down) |

- **Rent pressure is soft.** If you're short, the landlord waits and you take extra shifts. There is no debt, no interest and no eviction.
- **Excluded by rule:** loans, interest, credit, investment returns, gambling or chance-based money, alcohol, romance, magic.
- **The next district opens** when every word of the current stage is at least *met* **and** trust with the stage's key NPCs (listed in the setting) reaches a threshold. There is no savings target, so nobody has to grind for money.

### Word memory (learner model)

The unit is a **dictionary word** with a stable id from the language pack (`w0321`). Inflected forms count toward their dictionary word.

Each word has one record: `{ right, wrong, streak, helps, lapsed, firstSeen, lastSeen }`. `lapsed` means the word was missed, helped or found decayed since its last correct answer. Its state is derived from that record:

| State | Rule (all thresholds tunable) |
|---|---|
| unseen | no record |
| met | seen at least once, streak < 3, no miss or help since the last correct answer |
| shaky | missed or helped since the last correct answer, **or** was known and has decayed |
| known | streak ≥ 3 and not decayed |

- **Decay** runs on **real time**, not game days. A known word decays to shaky once `now − lastSeen > interval(streak)`, where `interval = 2^(streak−2)` days, capped at 60. So a streak of 3 lasts 2 days, a streak of 4 lasts 4 days, and so on. Decay sticks: seeing a decayed word again marks it `lapsed`, so it stays shaky until it is answered right. Otherwise just hearing it in a line would revive it before its review.
- **Evidence from an exchange:**
  - Each skeleton exchange lists its **hinge** words, the 1–3 words the right reply depends on.
  - A correct reply counts as right for the hinge words (streak +1).
  - A wrong reply counts as wrong for them (streak reset).
  - A help lookup on any word resets that word's streak and counts as a help.
  - Every other word in the line only updates `lastSeen`.
- **Hidden repetition:** when a scene fills a slot from a word group, it picks shaky words first, then met words, then any word. **Repeatable jobs** (`repeatable: true`, such as one more warehouse shift) are the review sessions. They pay a little less and lean on shaky words.

### Reply modes

The mode is chosen **per exchange** from the weakest state among its hinge words:

| Weakest hinge state | Mode | Input |
|---|---|---|
| unseen / met | **pick** | 2–4 options |
| shaky | **tiles** | assemble the reply from word tiles plus 1–2 distractor tiles |
| known | **type** | free text, only if the language pack enables typing; otherwise tiles |

Wrong options and distractor tiles are produced from the exchange's action by **varying slot values** (serve 4 instead of 3, coffee instead of tea). Close distractors are chosen by the helper ported from vocab-engine's `wordOpts`: same part of speech, same level, same word class. Wrong options are always plausible, never silly.

### Scenes and unlocking

- Scenes are ordered with `after: [sceneId]`. A scene is available when the scenes it follows are done and its `requires` (trust, items) are met.
- New words are defined by order: for each language, the build walks the scenes in order and marks each word **new** in the first exchange it appears in. Unlocking therefore doesn't need a separate check that the words are met.
- The **mentor**, a neighbour visited in the evening (costs one slot), unlocks usage notes once the player has hit their trigger (a tagged exchange or word). Notes are written per language, in the learner's language.
- The **notebook** fills automatically: word, pronunciation, gloss, the line it was first heard in, and audio. Words are grouped by the place they were learned, and progress toward the stage word list is shown.

### Rank ladder

The player's status is shown as a rank based on the share of the course's words that are *known*:

| Share known | Rank (English labels) |
|---|---|
| 0–19% | Pidgin |
| 20–39% | Getting By |
| 40–59% | Conversational |
| 60–84% | Fluent |
| 85%+ | Silver Tongue |

Labels live in the learner-language UI file. Thresholds are tunable.

## Architecture

The rules live in a game core that is separate from the 3D world, and two front ends sit on top of it.

```
packages/
  core/      pure TypeScript: content, learner, dialogue, life, save. No DOM, no three.js
  view/      shared screen-free logic both front ends use: word-help lists, option lists,
             tile checking, notebook grouping
  ui/        Preact components for the 3D game: speech bubble, reply panel, HUD, notebook, mentor
  tui/       text game: screens written against a Terminal interface
  tui-node/  Terminal backend: Node stdin/stdout, system audio player
  tui-web/   Terminal backend: xterm.js page, browser audio, on-screen key bar
  world3d/   3D game: three.js world + ui
content/     packs, settings, courses (see Content)
tools/       vocab-engine import, content build and checker, audio generation
```

### Core

- **One entry point:** `core.send(input) → Event[]`. The whole state is one plain JSON-serialisable object. The random number source and the clock are passed in, so every run can be replayed.
- **Inputs:** `goTo(place)`, `talkTo(npc)`, `startScene(id)`, `reply(choice | tiles | text)`, `helpWord(wordId)`, `replayLine(slow?)`, `buy(item)`, `visitMentor`, `sleep`.
- **Events:** `placeEntered`, `lineSpoken`, `replyOptions`, `actionPerformed`, `npcReacted`, `lineRephrased`, `walletChanged`, `trustChanged`, `wordStateChanged`, `unlocked`, `rankChanged`, `dayEnded`, `inputRejected`.
- **Places** and the connections between them are core data. In 3D, walking into a trigger zone sends `goTo`. In the TUI, picking from the place menu sends it.

| Module | Owns |
|---|---|
| content | Loads built course output: words, lines with word ids and audio ids, skeletons, world. |
| learner | Word records, state derivation and decay, slot filling, reply-mode choice, rank. |
| dialogue | Runs a scene: fill slots → send out lines → take a reply → turn it into an action → compare → reaction → evidence to learner, results to life. Rephrases after 2 misses. |
| life | Wallet, days and slots, trust, items, unlock rules. |
| save | Versioned JSON, export/import as a text string, local event log. |

### Reused from vocab-engine

We have the author's consent to reuse anything from [ishmum123/vocab-engine](https://github.com/ishmum123/vocab-engine). The engine reads **its own copy** of the content, in its own format. Nothing depends on vocab-engine changing.

- **Pack data:** `tools/import-vocab-pack` converts a vocab-engine pack (`pack.json`, `words.json`) into our format. Re-running it picks up upstream improvements. Our own additions (extra glosses, word groups) live in separate files that the import never touches.
- **Tagger:** the packbuilder (Python: spaCy/Stanza, plus the Chinese segmentation from the zh pack) is copied into `tools/` and used to tag rendered lines with word ids and spans.
- **Ported to TypeScript, with the origin noted in the code:**
  - `wordOpts` / `meaningOpts` → distractors;
  - `normalizeTyped` / `acceptTyped` → checking typed replies with each script's accent rules;
  - `findSurface` / `passageSegments` / spans → word help on inflected forms;
  - the save backup and import rules.
- **Not reused:** the drill UI, and the fixed learn-sets-of-10 progression.

## Content

```
content/
  languages/zh/
    pack.json            levels, stages, script, typing, TTS locale      (import)
    words.json           [{id, w, alt, pron, lv, pos}]                    (import)
    extra-words.json     bonus words not on the level list, e.g. 杯       (ours, never overwritten)
    terms.ftl            concepts as Fluent terms ($form variants, attributes)
    lines/<scene>.ftl    lines for each scene skeleton
    reactions.ftl        reusable reactions: wrong-count, wrong-item, …
  learner/en/
    ui.ftl               UI text, rank labels
    glosses-zh.ftl       glosses for zh word ids                           (import seeds it for en)
    glosses-zh-extra.ftl glosses for the bonus words
    mentor-zh.ftl        usage notes for zh
    narration-china-city.ftl
  settings/china-city/
    world.json           places and connections, NPCs, jobs, items, prices, currency,
                         slots per day, key NPCs per stage, trust thresholds
    groups.json          concept groups: { drinks: [tea, water], numbers_1_10: [...] }
    scenes/<id>.json     language-neutral scene skeletons
  courses/zh-china-en.json   { language: "zh", setting: "china-city", learner: "en" }
```

### Everything text uses Fluent

We use [Project Fluent](https://projectfluent.org) (`@fluent/bundle`) for all text: UI, glosses, narration, mentor notes and scene lines. Each language handles its own plurals, gender, measure words and formality without changing any other language's files.

Scene skeletons refer to **concepts**, never words. That is what keeps them language-neutral:

```json
{
  "id": "noodle-order-01",
  "place": "noodle_shop", "npc": "cook", "stage": 1,
  "after": ["noodle-intro"], "requires": { "trust": { "cook": 1 } },
  "exchanges": [
    { "id": "order",
      "slots": { "item": "drinks", "count": "numbers_1_10" },
      "expect": { "action": "serve", "item": "$item", "count": "$count" },
      "hinges": ["$item", "$count"],
      "pay": 3, "missCost": 2 }
  ]
}
```

Each concept is a Fluent **term**. Word forms a line may need (measure word, plural) are chosen with a `$form` parameter. Grammatical properties used only for choosing a form (gender) are term attributes, which Fluent allows only in selectors.

**Slot binding:** for each slot combination, the build defines the slot's name as a copy of the chosen concept's term. With `item = tea`, `-item` becomes a copy of `-tea`, attributes included. The copy is made on the parsed Fluent syntax tree (`@fluent/syntax`), not by text matching. Lines therefore always refer to `-item`, never to a specific concept. Number slots also pass the number as a variable (`$count`) for plural selection, alongside the term (`-count`) for the written word.

```ftl
# languages/zh/terms.ftl
-tea = { $form ->
    [measure] 杯
   *[base] 茶
}
-three = 三

# languages/zh/lines/noodle-order-01.ftl
order = { -count }{ -item(form: "measure") }{ -item }。
order-reply = 好，{ -count }{ -item(form: "measure") }{ -item }。
order-rephrase = { -item }。{ -count }{ -item(form: "measure") }。
```

```ftl
# languages/es/terms.ftl
-tea = { $form ->
    [plural] tés
   *[base] té
}
    .gender = masc
-three = tres

# languages/es/lines/noodle-order-01.ftl
order = { $count ->
    [one] Un { -item }, por favor.
   *[other] { -count } { -item(form: "plural") }, por favor.
}
```

### Build step (`tools/build-course <course>`)

1. Load the skeletons, Fluent files and word pack for the course.
2. **Fill in** every line for every slot combination, binding slot terms as described above. Combinations are small and bounded (e.g. 10 numbers × 3 drinks).
3. **Tag** each rendered line with the tagger to get word ids and spans. Authors never tag by hand.
4. **Mark new words** by walking the scenes in `after` order.
5. **Check** (below). Any error stops the build.
6. **Generate audio:** one clip per rendered line and one per word, using a TTS service at build time. Clips are mono, around 32 kbps. Unchanged lines are cached.
7. Write `dist/courses/<course>/`: rendered lines with word ids, spans and audio ids, plus skeletons, world and words. The game loads only this output.

### Content checker

The build fails if:

- a Fluent file fails to parse, or a message referenced by a skeleton is missing for the course's language;
- a rendered line uses a word above the scene's stage that isn't a bonus word (new words are defined by first appearance, so the only exception needed is an explicit bonus list);
- an exchange introduces more than 2 new words;
- a word on the stage list appears in fewer than 3 scenes;
- a line has no audio;
- a UI, narration, gloss or mentor key is missing for the learner language;
- a skeleton references an unknown place, NPC, group, concept, action or scene.

A single fixed-form line (for example, an irregular form that templating handles badly) can be written as an explicit Fluent variant for that slot value.

## Front ends

### Text game (TUI)

The TUI is written against a small interface:

```ts
interface Terminal {
  write(lines: StyledLine[]): void;
  onKey(handler: (key: Key) => void): void;
  size(): { cols: number; rows: number };
}
```

- **`tui-node`:** a real terminal, run with `npx silver-tongue`. Audio plays through the first system player it finds (`ffplay`, `paplay`, `afplay`). If none is found, lines show a "no audio" mark.
- **`tui-web`:** xterm.js in a page, with browser audio. On phones, an on-screen key bar (1–4, arrows, Enter, Esc) sits under the terminal.

```
┌ Noodle shop ─────────────────── Day 3 · slot 2/4 · ¥47 ┐
│ Steam everywhere. The cook waves you over.             │
│                                                        │
│ Cook:  三杯茶。                          [r]eplay [s]low │
│                                                        │
│ 1) 好，三杯茶。   2) 好，四杯茶。   3) 好，三杯水。           │
└ [1-3] reply · [w] word help · [n]otebook · [esc] menu ─┘
```

- **Word help:** `w` numbers the words in the current line, and pressing a number shows pronunciation and gloss (sends `helpWord`).
- **Replies:** pick by number. Tiles by typing tile numbers in order. Type where the pack allows typing.
- **Outside conversations:** a menu of places, people, work, mentor and sleep. Actions that cost a slot are marked.
- **Actions are narrated** from the learner-language narration file ("She sets down four cups. You ordered three.").
- **Width:** layout goes through a width-aware string function, since CJK characters take 2 cells. Only ANSI colour is used, so both backends look the same.

### 3D game

- **World:** three.js with toon shading and outlines, and low-poly CC0 models. Grey boxes come first and the art pass comes last.
- **Movement:** WASD relative to the camera. Mouse drag (or right-side touch drag) orbits the camera. A virtual joystick sits on the left on phones.
- **Places:** trigger zones send `goTo`. Near an NPC, an E key or tap prompt sends `talkTo` / `startScene`.
- **Conversation:** movement locks, the camera eases to frame the NPC, and speech bubbles float over their heads.
- **Events on screen:** `actionPerformed` plays the action (cups set down, boxes carried), and `npcReacted` plays a gesture along with the bubble.
- **UI:** Preact components over the canvas.
  - **Speech bubble:** name label, no portrait; tap a word for help; faint underline on new words; replay and slow replay (0.75×, same pitch).
  - **Reply panel:** changes shape for pick, tiles and type.
  - **HUD:** wallet, day and slots, rank.
  - **Notebook** and **mentor** views.
- **Signs, menus and price tags** in the world are written in the language being learned.

### Carried over from the original brief

- **Faceless characters:** no eyes, nose or mouth on any human or animal, and no portraits. Characters are told apart by outfit, colour, headwear, build and what they carry. Character loading keeps the head mesh swappable in one place.
- **No real people or licensed IP.** References are for look and feel only.
- **Economy and theme limits** as listed under *Money and trust*.

## Saves

- **Web:** `localStorage` key `silver-tongue:<course>`. **Node:** `~/.config/silver-tongue/<course>.json` (`$XDG_CONFIG_HOME` if set; `%APPDATA%` on Windows).
- Saves are versioned JSON. Export/import works as a text string, so players can move between devices and between the TUI and 3D (same course, same save).
- These rules follow vocab-engine:
  - A save that won't parse is kept as a backup and the game starts fresh with a visible notice.
  - An import is strict and backs up the current save first.
  - A storage failure switches to read-only with a warning.
- A local event log inside the save supports play-tests. There is no analytics service.

## Error handling

- **Bad content** fails the build, never at runtime.
- **Invalid input to the core** (a reply with no active scene, buying without the money) returns an `inputRejected` event with a reason. The core never throws on player input.
- **Missing audio:** the text shows with a "no audio" mark, and the game never blocks.

## Testing

| Layer | How |
|---|---|
| Core | Vitest unit tests for each module, with the random source and clock injected. |
| Whole-course bots | Scripted players (always right, always wrong, random, and realistic at ~70% right) drive the core through a full course. They check pacing (strong player reaches the gate in about 7 game days, struggling in about 10), no dead ends, money that never spirals, and every stage word met. The economy is tuned here. |
| Content | The checker runs in CI on every course. |
| TUI | Snapshot tests into a fake Terminal: CJK width, narrow terminals, each reply mode. |
| 3D | A Playwright smoke test: load, walk into the noodle shop, start a scene, reply. Everything else is checked by hand. |

## First course scope (zh-china-en, stage 1)

Taken from the original brief. The engine assumes more stages exist.

- **One street**, 6–8 places: rented room, noodle shop, fruit stall, small supermarket, bus stop, warehouse, tea house, and a locked gate to the stage 2 district.
- **About 8 NPCs:** landlord, mentor (neighbour), three employers, two shopkeepers, one repeating customer type.
- **Three jobs:**
  - dishwasher at the noodle shop: food and drink, measure words, 不, 有/没有;
  - delivery on foot: places, 在, 哪儿, 前面/后面, names and times;
  - porter at the warehouse: numbers, 这/那, 个, 大/小, 多少.
- **Daily life:** paying rent, buying food, asking the time, a phone message from the landlord, a wrong-bus mix-up.
- **About 25 scenes** of 4–6 exchanges, covering all 150 HSK 1 words, each in 3+ scenes.

## Out of scope for now

Multiplayer, accounts, leaderboards, LLM free chat, speech recognition, courses other than zh-china-en, and named day parts (the slot labels exist but are unused).

## Open questions

1. **TTS provider and budget** for pre-generated audio, and who does the native-speaker check (especially the tones of 一 and 不).
2. **Learner languages beyond English:** where Bengali (and other) glosses come from, and who reviews them.
3. **Audience:** adult self-learners, children, or both. This affects text size, humour and how much the mentor explains.
4. **Protagonist:** fixed, or player-chosen outfit and colour? Is there a backstory?
5. **City:** a generic fictional city, or one modelled on a real one?
6. **Faceless standard:** is a blank head enough? Do animals appear?
7. **Release intent:** private test, public and free, or paid later. This affects asset, font and TTS voice licences.
8. **Tuning:** the word-state thresholds, decay intervals, rank thresholds and economy numbers are starting values, to be set by the course bots and play-tests.
