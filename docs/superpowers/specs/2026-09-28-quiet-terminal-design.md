# Quiet terminal (2026-09-28)

A third browser page, `/quiet/` (`packages/quiet-web`), on the same core, view and web-common as the
visual novel. It looks like a terminal and follows the surprisal principle: an element earns ink in
proportion to how surprising it is times the cost of missing it. Expected state is whitespace; hidden
things stay one key away; absence is said plainly.

## Rules (pure, `packages/view/src/quiet.ts`, tested)

- **Anchor row** (`anchorRow`): always `Place · Day N, slot/slots`. Rent joins it only when
  - rent is late, or
  - pace: `wallet − foodPerDay × (dueInDays + 1) < rentPerWeek`, or
  - backstop: `dueInDays ≤ 1` and `wallet < rentPerWeek + foodPerDay × 3`: paying rent would leave under
    three days of food, a case pace doesn't cover.

  `dueInDays = day % 7 === 0 ? 0 : 7 − day % 7`: rent is charged on the sleep that ends a day divisible by 7
  (core `life.ts` `endDay`). That sleep charges food first, so the due night's food counts: hence `+ 1`.
  Day 1 never shows rent: the course's own opening prose already states the wallet and the rent.
  No wallet, rank or parcel on the row. Missing sound shows `🔇 no audio`. A repeat shift shows
  `repeat shift · pays ¥X` while it runs.
- **Gloss policy** (`glossPolicy`): unseen → boxed with its gloss on the next line (the only automatic
  gloss); shaky → dotted underline; met/known → bare. No pinyin or translation under NPC lines or on
  pick options.
- **Notebook** (`notebookDefault`): opens on the shaky words with why: `missed ×n` (wrong ≥ helps),
  `helped`, or `decayed`; shakiest first (most misses, then most recently seen). Header counts every
  state. `known ▸ met ▸ all ▸` switch to the full grouped notebook. No bars, no badges.
- **Review tell** (`reviewTell`): a repeatable scene already done once is a repeat shift; pay is the sum
  of its exchanges' full pay.

## Transcript

A reply's cost rides on the player's echoed line (`wallet-change` text, two spaces after it): soft red
for a miss (mix-up), dim for a price paid (shopping). Food is silent. Wages are the
scene's closing prose (`scene-done`). Rent paid is one line. Trust is silent. News (a new rank, a
new scene, a mentor note, an errand) is a toast, held until the scene ends so it never lands between a
line and its replies. A word glosses itself if it was heard for the first time in that line or has
never been heard (reaction lines don't count as hearing). A game picked up mid-scene replays the
current line and replies (core `describeRun`); between scenes it says where the player is.

A finished conversation stays whole until the player's next accepted input, so its ending can be read;
then it folds into one dim line, `✓ Scene · NPC · +¥X` (the NPC left out when the scene's name says it,
the pay only when there was some). What came before and after it stays. The notebook's Phrases tab keeps
what was said.

A miss is one beat of at most three rows, and every try stays in the transcript:

```
You: 好，六个桌子。  −¥1
You carry six tables. Big Liu wanted three tables.     (one dim italic line: action-* then asked-*)
Big Liu: 不是。 三个桌子。                            ?  (reaction, then the request said again in normal tone)
```

The italic line joins the action narration and the asked-* line; a scene with no action narration
(social scenes) shows the asked-* line alone. The reaction restates the request (the last line said or
rephrased in the exchange), so the next reply visibly answers the request, not `不是`. The restated
request glosses no new words (they were glossed when it was first said) and plays no clip: only the
reaction's clip plays. Its `?` opens the request's reading and meaning. After the second miss the
restated part is the rephrase (or the same line said slower), shown with its reading and meaning and a
dim `rephrase` / `(slower)` tag, and its clip plays after the reaction's: one NPC line, never the
request twice. A reaction with no replies after it (the scene ended) restates nothing. A right reply
is unchanged: the echo, the action narration if any, the next line.

An option's intent (dim, in brackets) shows only when the options' intents differ and that option
holds a word not yet known (met, shaky or unseen). One intent shared by all options tells nothing, and
once the player knows an option's words its intent would only translate it, so it goes.
Fonts are local (`ui-monospace` stack): the site makes no third-party requests.

## Escape hatches

- `?` on any NPC line (or the `?` key, or `w` as in the text game, for the latest one): reading and meaning under the line. Not
  logged as help.
- Tap a word: its card under the line. Logged as help (resets that word's streak), as the game intends.
- `N` / notebook: the notebook above.
- `S` / status: the full ledger: day and slot, wallet, rent and when it's due, rank, parcel, sound,
  trust per NPC.
- `O` / settings: settings, games (export/import), links to the other two pages.
- Touch screens get a key bar: `? N S ⌫ ↵`.

## Deviations from the concept board (from the mockup)

- Money and rent leave the anchor row after day 1; they return only when pace says you'll be short, or
  on the last day before due (backstop).
- Pinyin and translations are hidden by default; one `?` reveals a whole line. Only unseen words gloss
  themselves.
- Hint tiers (1/3, 2/3, 3/3) removed. Cost + NPC reaction first, authored rephrase after the second miss.
- Quiz/Review screen removed. Review is a repeat shift that pays less; the lower pay is the only tell.
- Timer removed: the game has day slots, not a clock.
- Confidence bars and memory bars removed. Reply mode (pick / tiles / type) and the notebook's "why"
  column carry that information.
- Absence is made unambiguous: audio failure renders `🔇 no audio` in the anchor row; a missing save
  renders "no save found", never a fresh day 1 dressed as one.

## Not done (yet)

- The notebook's "helped Day 3" from the mockup: word records keep no day of help, only `lastSeen`.
- The mockup's `look` / `help` commands: the game has no such inputs. The command line lists the
  place menu's own labels, numbered.
