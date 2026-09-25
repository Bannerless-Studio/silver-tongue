# B3, slice 2a: the warehouse, numbers to ten, and the rent talk

2026-09-25 · status: design approved in conversation, written up for review

B3 slice 2 (jobs and places) ships one job at a time:

- **2a** (this document, `silver-tongue@0.8.0`): Market Street, the warehouse and its foreman, numbers 六 to 十, and Mr Li's talk about rent.
- **2b:** delivery on foot, and the places you deliver to.
- **2c:** the dishwasher job, and the shops.

Slice 1 is `2026-09-25-b3-1-life-structure-design.md`. Slice 3 (HSK 1 coverage and economy) follows 2c.

## Goal

The player finds a second job, learns to count to ten, and hears what the rent is in Chinese. Every new line was drafted against the real checker and bots before this spec was written.

**Success means:**

- **Map:** Main Street leads to Market Street, which holds your room and the warehouse. Main Street's menu stays at 7 items.
- **Warehouse:** the foreman, Big Liu (大刘), teaches 六 to 十 and offers work. The warehouse shift is paid and repeatable. It teaches 个, 桌子, 椅子, 大, 小 and 那个.
- **Rent talk:** Mr Li says 一个星期……五十块, and you ask 多少钱？. Rent itself stays automatic.
- **Notes:** two new mentor notes explain 个 (and 两, not 二) and 块.
- **Checks pass:** the build and all tests pass. The bots report `rejected 0`, `dead-end days 0` and `broke without work 0`, and read every note.

**Not in 2a:**

- buying food, clock times, the bus and the phone (2b, 2c);
- paying rent in person, and any economy tuning (slice 3);
- any core or front-end change.

## 1. Map

`content/settings/china-city/world.json`:

| Place | Links | Scenes |
|---|---|---|
| `street` (Main Street) | `noodle_shop`, `market` | 4 of Old Wang's, plus the mentor item |
| `noodle_shop` | `street` | unchanged |
| `market` (Market Street), new | `street`, `room`, `warehouse` | none yet; the 2b/2c shops go here |
| `room` | `market` (was `street`) | `room-hello`, `room-rent` |
| `warehouse`, new | `market` | `warehouse-intro`, `warehouse-shift` |

- **Main Street:** 2 exits, 4 scenes and the mentor item make exactly 7 items, the checker's limit.
- **Your room moves to Market Street.** Walking is free, and the checker's reachability rule still holds: every place can reach `room`.
- **New NPC:** `foreman`, at `warehouse`.
- **Narration:**
  - `place-market` and `place-market-desc` (which mentions your room upstairs), `place-warehouse` and `place-warehouse-desc`, `npc-foreman = Big Liu`.
  - `place-street-desc` changes: the room is no longer "a little way down" Main Street. Market Street is instead.
  - `intro-3` keeps saying "a room for you down the street", which is still true.

**Old saves:**
- A save in `room` loads, and the room's only exit is now Market Street.
- A save on Main Street finds the room exit replaced by Market Street.
- No save field changes.

## 2. The foreman: `warehouse-intro`

- **Setup:** at `warehouse` with `foreman`, one-off, after `street-numbers` (you can count to five), `trustGain: 1`.
- **Name:** Big Liu is a new name word, `x0006` = 大刘, glossed in `glosses-zh-extra.ftl` like 老王 and 小张.

| Exchange | Action | Big Liu | You | New words |
|---|---|---|---|---|
| `greet` | `greet` | 你好！你叫什么名字？ | 我叫{player}。 | none |
| `names` | `foreman` | 我叫大刘。 | 你好，大刘！ | 大刘 |
| `six-seven` | `numbers` | 一，二，三，四，五，六，七。 | 六，七。 | 六 七 |
| `eight-nine` | `numbers` | 六，七，八，九。 | 八，九。 | 八 九 |
| `ten` | `numbers` | 八，九，十！ | 十！ | 十 |
| `job` | `job` | 很好！你会工作吗？ | 会！ | 会 工作 |
| `bye` | `bye` | 好！再见，{player}！ | 谢谢！再见，大刘！ | none |

- **Wrong replies:** each exchange has two, using only words met by then.
- **English:** every line's meaning is in `content/learner/en/lines-zh/warehouse-intro.ftl`.
- **Actions:** `greet`, `numbers`, `job` and `bye` already exist, and their `asked-` lines say "they", so they fit. `foreman` is new: `asked-foreman = They were telling you their name.`

## 3. The warehouse shift: `warehouse-shift`

- **Setup:** at `warehouse` with `foreman`, repeatable, after `warehouse-intro`, `requires: { trust: { foreman: 1 } }`, `trustGain: 1`.

| Exchange | Slots | Big Liu | You | Action | Pay / miss |
|---|---|---|---|---|---|
| `carry` | `amount: numbers_3_10`, `item: furniture` | {amount}个{item}。 | 好，{amount}个{item}。 | `carry` (amount, item) | 3 / 1 |
| `pick` | `size: sizes`, `item: furniture` | 那个{size}{item}。 | 好，那个{size}{item}。 | `pick` (size, item) | 2 / 1 |

- **Rephrases:** both exchanges have one, in the same shape as the noodle shift: `{item}。{amount}个。` and `{size}{item}。那个！`.

**Content plumbing:**
- **Groups (`groups.json`):**
  - `numbers_3_10` is three to ten: 两 is HSK 2, so the group starts at 三;
  - `furniture` is `table`, `chair`;
  - `sizes` is `big`, `small`.
- **Numbers map:** `numbers` gains six to ten.
- **Terms:**
  - `languages/zh/terms.ftl`: `-six` … `-ten`, `-table` (桌子), `-chair` (椅子), `-big` (大), `-small` (小);
  - `learner/en/terms.ftl`: the same names, with `cap` and `base` forms.
- **The count slot is `amount`, not `count`.** The slice 1 checker rule keeps a slot that has its own reaction (`wrong-count` = 几杯？) to one group, and the noodle shop's `count` draws from `numbers_3_5`.
- **Narration:**
  - `action-carry = You carry { $amount } { $item }s.` and `asked-carry = They wanted { $amount } { $item }s.`;
  - `action-pick = You pick up the { $size } { $item }.` and `asked-pick = They wanted the { $size } { $item }.`
- **English meanings:** "Eight chairs." / "OK, eight chairs." and "That big table." / "OK, that big table." Every count in the group is 3 or more, so the plural "s" is always right.
- **Pay:** a full shift pays up to ¥5, like the noodle shift. Economy tuning waits for slice 3.

## 4. The rent talk: `room-rent`

- **Setup:** at `room` with `landlord`, one-off, after `room-hello` and `warehouse-shift`, `trustGain: 1`.
- **Why after a shift:** 一个星期 needs 个 already met. Otherwise that line would bring three new words (个, 星期, 块) against the limit of two.

| Exchange | Action | Mr Li | You | New words |
|---|---|---|---|---|
| `greet` | `greet` | 你好，{player}！ | 你好，李先生！ | none |
| `money` | `money` | 你有钱吗？ | 有。我工作。 | 钱 |
| `week` | `rent` | 一个星期…… | 多少钱？ | 星期 多少 |
| `price` | `price` | 五十块。 | 好，五十块。 | 块 |
| `bye` | `bye` | 谢谢！再见！ | 再见，李先生！ | none |

- **New actions:** `money`, `rent` and `price`, each with an `asked-` line in the narration file.
- **Rent stays automatic.** It is still taken at the end of each week, as in `life.ts`. In the drafted run every bot has this talk on day 4, before the first rent on day 7.

## 5. Mentor notes

`languages/zh/notes.json` and `learner/en/mentor-zh.ftl`:

- **`ge`** (triggered by the word 个, w0012): 个 is the everyday measure word, 八个椅子. For two, say 两个, not 二个; 二 is for counting.
- **`kuai`** (triggered by the scene `room-rent`): people say 块 for yuan, 五十块. 多少钱？ means "how much?".

## 6. Testing and release

- **Content tests** (`tools/test/build-course.test.ts`):
  - the pinned scene list gains the three scenes;
  - one test pins the new map: every place reaches `room`, and Main Street has exactly 7 menu items. The checker enforces both already, but the test names the design.
- **Bots:** the CI test holds as is (no rejects, no dead ends, no broke-without-work, every note read). With 7 notes, `notesRead` must be 7.
- **By hand:**
  - in a terminal pty, walk to the warehouse, count to ten, work a shift, pick a wrong item on purpose (see `asked-carry`), then go home through Market Street and have the rent talk;
  - in the browser at phone width, check the Market Street and warehouse menus.
- **Review:** an opus review of the branch. Fix every Important finding before merge.
- **Release:** bump `packages/tui-node` to 0.8.0, run `npm install --package-lock-only`, merge `--no-ff` to `main`, and push.
