# B3 slice 3: all of HSK 1, and money balance

Status: approved in conversation 2026-09-26; ships as one release, **0.11.0**.

## Goal

Every HSK 1 word is in at least 3 scenes, and the build enforces it (`checks.coverage: true`). Money is
"tight but fair": steady right answers pay rent and food and leave about ¥20–30 a week to spend; wrong
answers leave you short.

Today (0.10.0) 18 scenes use 81 of 150 stage-1 words: 71 words are in no scene, 32 in one and 13 in
two. A player who answers wrong twice on every exchange earns full pay, so the wrong bot ends with
more money than the right one.

## Decisions (from the user)

- One release, not several.
- Money: tight but fair.
- Content only: no phone or ride mechanics. A phone call is a normal scene in your room.
- Approach A: new places and people, plus edits to old lines where a word can't reach 3 scenes
  otherwise.

## Part 1: world and scenes

### New places and people

Every place stays within the 7-item menu (scenes + exits + the mentor where he stands).

| Place (id) | Linked from | Person (npc id, name) | Scenes | Menu items |
|---|---|---|---|---|
| Tea house (`tea_house`) | Station Road | owner (`teaboss`, 老陈 Lǎo Chén) | `tea-intro`, `tea-shift` (repeatable, paid), `tea-weather`, `tea-tv` | 1 + 4 = 5 |
| Stairwell (`stairs`) | your room | neighbour (`neighbour`, 林太太 Lín tàitai) | `stairs-meet`, `stairs-family`, `stairs-pets` | 1 + 3 = 4 |
| School (existing) | — | classmate (`classmate`, 大卫 Dàwèi); the teacher | `class-first`, `class-write`, `class-break`, `class-read` | 1 + 1 + 4 = 6 |
| Train station (existing) | — | driver (`driver`, 老马 Lǎo Mǎ) | `taxi-way`, `taxi-luggage` (repeatable, paid), `taxi-visitor` | 1 + 1 + 3 = 5 |
| Your room (existing) | — | Mr Li on the phone (`landlord`) | `room-phone` | 2 + 3 = 5 |
| Hospital (existing) | — | the doctor | `hospital-checkup` | 1 + 2 = 3 |
| Noodle shop (existing) | — | the cook | `noodle-lunch` | 1 + 4 = 5 |

Station Road goes from 4 to 5 items (the tea house exit); the room from 3 to 5 (stairwell exit and
the phone scene). Names are bonus words in `extra-words.json` with glosses in
`glosses-zh-extra.ftl`.

### Words each place carries (the main new ones)

- **Tea house:** 喝 请 坐 认识 高兴 今天 天气 冷 热 下雨 几 分钟 时候 电视 电影 看见 和 都
- **Stairwell:** 他 她 我们 人 爸爸 妈妈 儿子 女儿 岁 家 爱 狗 猫 漂亮 衣服
- **Chinese class:** 学习 汉语 写 读 字 本 同学 电脑 说话 听 会 能
- **Taxi stand:** 出租车 飞机 坐 回 来 上 下 中国 怎么 怎么样 上午 下午 年 月 日 昨天 零 先生 小姐
- **Phone call:** 喂 打电话 明天 睡觉 商店 做

Words now in 1–2 scenes (桌子 医生 水果 星期 …) are worked into the new scenes first. Where one
still falls short, an existing line is edited; every existing scene keeps its story.

先生 and 小姐 must appear on their own (the segmenter reads 李先生 and 高小姐 as single name
words). Likewise 不 must appear as its own word: compounds such as 不客气 are separate pack words.

### Order of play

- `tea-intro` after `delivery-intro` (the player knows Station Road).
- `stairs-meet` after `room-rent`.
- `class-first` and `taxi-way` after `delivery-pickup`. (Planned after `delivery-school` and
  `delivery-station`, but parcel destinations are random, so a story scene gated on one drop-off could
  wait indefinitely; in bot runs the always-right player never met Old Ma.)
- `hospital-checkup` after `delivery-pickup` and `tea-weather` (it follows the rain).
- `taxi-visitor` after `taxi-way` and `tea-intro`; `noodle-lunch` after `noodle-kitchen` and `room-rent`.
- `room-phone` after `room-rent` and `tea-weather` (明天 下雨 comes from the weather talk).
- Later scenes in each place follow its first one. All checker rules hold: at most 2 new words per
  exchange (against ancestor scenes), replies at most 7 tiles, NPC lines at most 9 words, an
  `asked-<action>` narration line for every action, alts use only met words, and a slot with a
  `wrong-<slot>` reaction draws from one group.

## Part 2: money

### Pay depends on how you answered (core)

In `resolve` (`packages/core/src/dialogue.ts`), a right reply earns `payFor(ex.pay, run.misses)`
instead of `ex.pay`:

- 0 misses on this exchange: full pay;
- 1 miss: `Math.floor(pay / 2)`;
- 2 or more (the person has rephrased): 0.

`run.misses` already resets for each exchange. `missCost` penalties stay as they are. `payFor` is
exported from core and tested directly. No new events, inputs or state.

### Numbers

Rent stays ¥50 a week, food ¥5 a day, start wallet ¥20. Pay was tuned with the bots until the CI
rules below passed; ¥6 a slot (the first guess) and ¥8 left the right bot ¥7–19 after rent, and ¥9
passed. After release the user raised it to ¥10 a job slot to ease things for a player who gets
most, not all, replies right; a delivery pays ¥20 for its two slots (pickup and drop-off):

| Scene | Exchange pay | Total |
|---|---|---|
| warehouse-shift | carry 7, pick 3 | 10 |
| noodle-shift | drink 2, order 8 | 10 |
| noodle-kitchen | cups 6, lunch 2, out 2 | 10 |
| tea-shift | pour 6, table 2, busy 2 | 10 |
| taxi-luggage | bags 6, train 2, phone 1, pay 1 | 10 |
| delivery-hospital | who 3, doctor 3, bye 14 | 20 |
| delivery-school | who 3, teacher 3, books 3, bye 11 | 20 |
| delivery-station | who 3, beijing 3, time 3, bye 11 | 20 |

Bots, 14 days, seed 7:

| Bot | End wallet | Rent late (nights) | Earned | Spent at shop | Lowest after rent |
|---|---|---|---|---|---|
| right | 133 | 0 | 290 | 7 (2 buys) | 28 |
| wrong | 0 | 8 | 0 | 0 | never paid |
| random | 7 | 5 | 199 | 4 | 7 |
| learner (70% right) | 25 | 3 | 216 | 4 | 6 |

Tuning needed three bot strategy changes, each a sensible player's habit: work when rent is due
within two nights and the wallet is short of rent plus a week's food; shopping with money to spare
takes turns with paid work; and a job never tried counts as story (later scenes may come after it).

### Bot report

`BotReport` (tools/src/bots.ts) gains:

- `rentLateNights`: nights `rentLate` was true after `endDay`;
- `earned`: total `wages` wallet changes;
- `shoppingSpent`: total `shopping` wallet changes (positive number);
- `minAfterRent`: the lowest wallet right after a rent payment (`Infinity` if rent was never paid).

`main` prints them.

### CI rules (14 days, seed 7)

- **right:** `rentLateNights` 0, `minAfterRent` ≥ 20, `shopping` ≥ 2.
- **wrong:** `earned` ≤ half of the right bot's `earned`, `rentLateNights` ≥ 1.
- **all bots:** as today: `rejected` 0, `deadEndDays` 0, `brokeWithoutWork` 0, all notes read, the
  right bot finishes every one-off scene, right-bot errands > 0.

## Part 3: checks and testing

- `content/courses/zh-china-en.json`: `checks.coverage` becomes `true`; the build fails unless every
  stage-1 word is in at least 3 scenes.
- Core tests: `payFor` for 0, 1, 2 and 3 misses; a scene run where one miss halves the exchange's
  pay and the next exchange pays in full.
- Bot tests: the new report fields and the CI rules, each shown to fail when broken (both ways).
- Build tests: the pinned scene list, the notes list if notes are added (`hui-neng`, `zai`), the map
  test (the checker already enforces the 7-item menu for every place, so the test pins the new
  links and people), and coverage being on.
- Play-test at 46 columns with FakeTerminal: one new scene in each place plus the phone call; the pty
  smoke test of `packages/tui-node/dist/silver-tongue.mjs`; a browser check.
- One opus review of the whole branch; every finding fixed, minors included.

## Not in this slice

- The tile echo dropping punctuation.
- Audio (B4).
- Phone or ride mechanics.
