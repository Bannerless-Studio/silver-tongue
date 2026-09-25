# B3, slices 2b and 2c: deliveries, the kitchen and the shop

2026-09-26 · status: design approved in conversation, written up for review

This spec covers two releases. Each gets its own plan, review and version:

- **2b** (`silver-tongue@0.9.0`): Station Road, Miss Gao's deliveries, and the errand the game uses to carry a parcel between places.
- **2c** (`silver-tongue@0.10.0`): the dishwasher job at the noodle shop, and a corner shop where you spend money.

Slice 2a (`2026-09-25-b3-2a-warehouse-design.md`) came before. Slice 3 (the rest of HSK 1, and economy tuning) follows.

## Goal

The player takes their third and fourth jobs, walks parcels across the map, and buys something with their own money. Every line below was drafted against the real checker before this spec was written, and it passes. HSK 1 coverage rises from 48 to 83 of 150 words.

**Success means:**

- **Deliveries (2b):** Miss Gao names a place in Chinese. You walk there on the map and hand the parcel over. Nothing on screen says where it goes.
- **Kitchen (2c):** a repeatable dishwashing shift that pays.
- **Shop (2c):** a repeatable purchase, where the price you agree to comes out of your wallet.
- **Old saves:** they load unchanged.
- **Checks pass:** the build and every test pass. The bots report `rejected 0`, `dead-end days 0` and `broke without work 0`, read every note, and deliver parcels.

**Decisions from the conversation:**
- Deliveries are walked, not talked through (approach A, an errand).
- Shopping is practice only: food and rent stay automatic.

**Not here:**
- a general flags system;
- buying food that feeds you;
- a bike, phone messages, the bus;
- economy tuning (slice 3).

---

# Part 1: 2b, deliveries (0.9.0)

## 1. The errand (core)

An errand is one parcel the player carries from the scene that starts it to the scene that ends it. All the changes below are additive: `Input`, `GameEvent` and `RejectReason` only grow, and nothing existing changes.

**Scene fields** (`packages/core/src/types.ts`, both optional):
- `startsErrand?: string`: `"$<slot>"`, a slot of one of this scene's exchanges. Its value (a concept name) is the id of the place the parcel goes to.
- `endsErrand?: boolean`: finishing this scene delivers the parcel. The scene's `place` is the delivery address.

**State:** `GameState.errand?: { to: string }`. It is absent when nothing is being carried.

**Rules:**
- **Availability** (`isAvailable` in `life.ts`):
  - A `startsErrand` scene is unavailable while an errand is open. You carry one parcel at a time.
  - An `endsErrand` scene is available only while `state.errand.to === scene.place`.
  - Both still obey `after`, `requires` and `repeatable` as today.
- **Starting:** when a `startsErrand` scene finishes, the core sets `errand = { to: run.combo[slot] }` and emits `{ type: "errandStarted"; to }`.
  - It happens whether or not the player understood. The combo is what Miss Gao said.
  - A wrong reply shows the usual `asked-deliver` line in English ("They wanted it taken to the hospital"). That is the player's second chance.
- **Ending:** when an `endsErrand` scene finishes, the core clears `errand` and emits `{ type: "errandEnded"; to }`. The scene's pay is its wages, as usual.
- **Overnight:** sleeping keeps the parcel. There is no deadline.
- **No "New:" line for delivery scenes:** the core emits no `unlocked` event for an `endsErrand` scene, so no line appears after every pickup. `errandStarted` takes its place.
- **Scenes can't be left midway,** so an errand can't be half-started.

**Save** (`save.ts`):
- A missing `errand` loads as none.
- An `errand.to` that is not a place in the course is dropped, so the pickup opens again.

**Front end** (`packages/tui`):
- On `errandStarted`, print `errand-started = You're carrying a parcel.`
- On `errandEnded`, print `errand-ended = You hand over the parcel.`
- While an errand is open, the status line adds ` · { carrying }`, where `carrying = parcel`.
- The destination is never shown.
- The new keys go in `ui.ftl` and `UI_KEYS`.

**Checker** (`tools/src/check.ts`):
- `startsErrand` must name a slot used by one of the scene's exchanges, and every concept in that slot's group must be a place id.
- Every destination place has exactly one `endsErrand` scene at that place.
- Every `endsErrand` scene's place is the destination of some `startsErrand` scene.
- Error messages follow the existing style, e.g. `delivery-pickup: errand goes to "school", which has no scene that ends an errand`.

**Bots** (`tools/src/bots.ts`):
- **Pickups:** a `startsErrand` scene counts as paid work (rank 2), since the trip pays at the other end.
- **Deliveries:** while an errand is open, delivering it is rank 1. The bot walks there with `stepToward`.
- **Report:** `BotReport.errands` counts parcels delivered, and `main()` prints it.

## 2. Map

| Place | Links | Scenes |
|---|---|---|
| `market` (Market Street) | `street`, `room`, `warehouse`, `station_road` (new) | `delivery-intro`, `delivery-pickup` (Miss Gao's stall) |
| `station_road` (Station Road), new | `market`, `school`, `hospital`, `station` | none |
| `school`, new | `station_road` | `delivery-school` |
| `hospital`, new | `station_road` | `delivery-hospital` |
| `station` (Train Station), new | `station_road` | `delivery-station` |

- **Market Street:** 4 exits + 2 scenes = 6 menu items; 2c's shop makes 7.
- **New NPCs:**
  - `dispatcher` (Miss Gao, 高小姐, a new name word `x0007`) at `market`;
  - `doctor` at `hospital`, `teacher` at `school`, `traveller` at `station`.
- **Station Road's description** matches the lesson: the school is in front of the hospital, and the station is behind it.
- **Group:** `destinations` = `hospital`, `school`, `station`. The concept names are the place ids, and the checker holds them together. The terms are 医院, 学校, 火车站 / hospital, school, train station.

## 3. Scenes

**New words per exchange never exceed two.** The alternative wrong replies (in the draft files) use only words met by then.

### `delivery-intro`: Meet Miss Gao

- **Setup:** at `market` with `dispatcher`, one-off, after `warehouse-shift` and `room-hello`, `trustGain: 1`.
  - `after` also sets the order: you've worked for Big Liu before Miss Gao hires you.
  - It also supplies 这, 个 and the other words the pickup builds on.

| Exchange | Action | Miss Gao | You | New words |
|---|---|---|---|---|
| `greet` | `dispatcher` | 你好！我是高小姐。你是{player}吗？ | 是，我是{player}。 | 高小姐 |
| `hospital` | `places` | 医院在那里。 | 医院在那里。 | 医院 在 |
| `school` | `places` | 学校在医院前面。 | 在医院前面。 | 学校 前面 |
| `station` | `places` | 火车站在医院后面。 | 在医院后面。 | 火车站 后面 |
| `where` | `where` | 学校在哪里？ | 在医院前面！ | 哪 |
| `job` | `job` | 很好！你想工作吗？明天来！ | 想！我明天来。 | 明天 来 |
| `bye` | `bye` | 再见，{player}！ | 再见，高小姐！ | none |

- **哪儿:** the pack has no 儿 on its own, so the course uses 哪里 / 那里, and the `nali` note mentions 哪儿.

### `delivery-pickup`: Take a delivery

- **Setup:** at `market` with `dispatcher`, repeatable, after `delivery-intro`, `requires: { trust: { dispatcher: 1 } }`, `startsErrand: "$place"`, `trustGain: 1`.

| Exchange | Slots | Miss Gao | You | Action | Pay / miss |
|---|---|---|---|---|---|
| `parcel` | `place: destinations` | 这个东西，去{place}。 | 好，我去{place}。 | `deliver` (place) | 0 / 1 |
| `now` | none | 你现在去吗？ | 我现在去！ | `now` | 0 / 0 |

- **Rephrase:** `{place}！这个东西。`
- **New words:** 东西, 去, 现在.

### Deliveries

- **Setup:** each scene is at its place with its NPC, repeatable, after `delivery-pickup`, `endsErrand: true`, `trustGain: 1`.
- **Menu name:** all three are called "Deliver the parcel". Only one is ever available, and it is never announced, so the distinct-names test skips `endsErrand` scenes.
- **Pay:** each trip pays ¥8. A trip is 2 scenes, about ¥4 per scene against the warehouse's ¥5.

**`delivery-hospital`** (doctor):

| Exchange | Doctor | You | Pay | New words |
|---|---|---|---|---|
| `who` | 你好！你是谁？ | 我是高小姐的朋友。 | 2 | 谁 的 |
| `doctor` | 谢谢！我是医生。 | 你好，医生！ | 2 | 医生 |
| `bye` | 这是八块钱。再见！ | 谢谢，医生！再见！ | 4 | none |

**`delivery-school`** (teacher):

| Exchange | Teacher | You | Pay | New words |
|---|---|---|---|---|
| `who` | 你好！你是谁？ | 我是高小姐的朋友。 | 2 | 谁 的 |
| `teacher` | 好！我是老师。 | 你好，老师！ | 2 | 老师 |
| `books` | 这是书吗？ | 是，是书。 | 2 | 书 |
| `bye` | 谢谢！学生喜欢书。 | 不客气！再见！ | 2 | 学生 |

**`delivery-station`** (traveller):

| Exchange | Traveller | You | Pay | New words |
|---|---|---|---|---|
| `who` | 你好！你是谁？ | 我是高小姐的朋友。 | 2 | 谁 的 |
| `beijing` | 谢谢！我去北京。 | 北京！很好！ | 2 | 北京 |
| `time` (slot `hour: numbers_3_10`) | 现在{hour}点了！ | {hour}点了！再见！ | 2 / miss 1 | 点 |
| `bye` | 再见！ | 再见！ | 2 | none |

**Narration:** places, NPC names (Miss Gao, Doctor, Teacher, Traveller), start and end lines for each scene, and `asked-` lines for every new action. `asked-deliver = They wanted it taken to the { $place }.` and `action-deliver = You'll take it to the { $place }.` The drafts are in the working notes, and the plan copies them.

## 4. Mentor notes

- **`nali`** (scene `delivery-intro`): 哪里 is "where", 那里 "there" and 这里 "here". In the north people say 哪儿, 那儿 and 这儿. They mean the same.
- **`de`** (word 的): 的 links an owner to a thing: 高小姐的朋友, "Miss Gao's friend".
- **`dian`** (word 点): 三点 is three o'clock. 现在几点？ asks the time.

---

# Part 2: 2c, the kitchen and the shop (0.10.0)

## 5. Prices (core)

- **Skeleton:** an exchange may have `cost: number | "$<slot>"`. A slot must draw from concepts in `groups.json`'s `numbers` map.
- **Build:** the cost is resolved per variant, `Variant.cost?: number`, because the course doesn't carry the numbers map.
- **When it's paid:** on a matched reply, the core takes `variant.cost` from the wallet with a new wallet reason, `"shopping"`. A wrong reply buys nothing.
- **Affordability:** a scene whose exchanges cost money is available only while the wallet covers the most it could cost (the sum of each exchange's highest variant cost). The wallet never goes below zero, and nothing is bought on credit.
- **Front end:** the wallet line for `shopping` gets its UI string, `wallet-shopping`, following the existing wallet reasons.
- **Checker:** a slot-based `cost` must name a slot of that exchange whose values are all in `numbers`, and a number `cost` must be ≥ 0.
- **Bots:** they shop only when the wallet stays at or above a week's rent after paying (rank 3).

## 6. Map

- **Market Street** gains the exit `shop` (Corner Shop), giving 5 exits + 2 scenes = 7 items, the limit.
- **New NPC:** `shopkeeper` at `shop`.
- **Groups:**
  - `foods` = `rice` 米饭, `dishes` 菜, `noodles` 面条;
  - `goods` = `apple` 苹果, `cup` 杯子, `book` 书.

## 7. Scenes

### `noodle-kitchen`: Wash dishes

- **Setup:** at `noodle_shop` with `cook`, repeatable, after `noodle-shift` and `delivery-pickup`, `requires: { trust: { cook: 2 } }`, `trustGain: 1`.
  - The order puts it after the delivery job, one job at a time, and supplies 个, 去 and six to ten.

| Exchange | Slots | Cook | You | Action | Pay / miss | New words |
|---|---|---|---|---|---|---|
| `cups` | `amount: numbers_3_10` | 杯子！{amount}个！ | 好，{amount}个杯子！ | `wash` (amount) | 2 / 1 | 杯子 |
| `lunch` | `food: foods` | 中午了！你吃{food}吗？ | 好，我吃{food}！ | `eat` (food) | 1 / 1 | 中午, the food |
| `out` | none | 杯子没有了！ | 我去买杯子。 | `out` | 2 / 0 | 没 买 |

### `shop-intro`: Meet the shopkeeper

- **Setup:** at `shop` with `shopkeeper`, one-off, after `noodle-kitchen` and `room-rent` (for 块), `trustGain: 1`.

| Exchange | Action | Shopkeeper | You | New words | Cost |
|---|---|---|---|---|---|
| `greet` | `browse` | 你好！你买什么？ | 我看看。 | 看 | |
| `fruit` | `fruit` | 好。这些是水果。 | 水果！很好。 | 些 水果 | |
| `apples` | `apples` | 这个苹果很好！ | 我喜欢苹果。 | 苹果 | |
| `price` | `haggle` | 一个苹果，五块。 | 五块？太多了！ | 太 多 | |
| `less` | `less` | 好，少一块。四块。 | 好，我买一个。 | 少 | 4 |
| `bye` | `bye` | 谢谢！再见！ | 再见！ | none | |

### `shop-buy`: Buy something

- **Setup:** at `shop` with `shopkeeper`, repeatable, after `shop-intro`, `requires: { trust: { shopkeeper: 1 } }`, `trustGain: 1`.

| Exchange | Slots | Shopkeeper | You | Action | Cost |
|---|---|---|---|---|---|
| `buy` | `item: goods`, `price: numbers_3_5` | {item}？{price}块。 | 好，{price}块。 | `buy` (item, price) | `$price` |
| `bye` | none | 谢谢！ | 不客气！再见！ | `bye` | |

## 8. Mentor notes

- **`mei`** (word 没): 没有 is "don't have / there isn't": 杯子没有了, "we're out of cups". Use 不 for most other verbs, but it's always 没有, never 不有.
- **`tai`** (word 太): 太…了 is "too …": 太多了, "that's too much".

---

## 9. Testing and release

For each release:

- **Core tests (Vitest), first:**
  - **2b:**
    - errand availability both ways, starting at scene end with the drawn place, ending and clearing;
    - no `unlocked` event for delivery scenes;
    - the errand is kept overnight;
    - save round-trip, with an unknown `to` dropped.
  - **2c:**
    - cost taken on a right reply, not on a wrong one;
    - a scene unavailable when it can't be afforded;
    - `shopping` reason.
- **Checker tests:** every new rule with a failing fixture.
- **TUI tests:** the errand lines and the status marker (2b); the shopping wallet line (2c).
- **Content tests** (`build-course.test.ts`):
  - pin the scene list and the map;
  - Market Street at the item limit;
  - destinations are places;
  - the distinct-names test skips delivery scenes.
- **Bots:**
  - the CI test adds `errands > 0` for the right-answer bot (2b);
  - existing assertions hold;
  - the notes count becomes 10, then 12.
- **By hand:**
  - in a terminal pty, take a parcel, answer wrong on purpose, read the English line, walk to the right place and deliver (2b);
  - wash dishes, meet the shopkeeper, buy something and watch the wallet (2c);
  - in the browser at phone width, check Market Street's 7-item menu and the status marker.
- **Review:** one opus review of each branch. Fix every finding, minors included.
- **Release:**
  - bump `packages/tui-node` (0.9.0, then 0.10.0), run `npm install --package-lock-only`, merge `--no-ff` to `main`, and push;
  - then update the progress artifact.
