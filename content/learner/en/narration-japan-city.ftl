# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = Tokyo, 1995. Your bag was stolen on the first night, with your passport in it, and the embassy says a new one takes weeks. There is no phone in your pocket and nobody on this street speaks your language: whatever you have to say, you will say it in Japanese.
intro-2 = You have { $currency }{ $wallet }. A landlady down the street has a room; the rent, { $currency }{ $rent }, falls due at the end of each week, and food costs money every day.
intro-3 = The ramen shop is short of hands. It needs words, and words get you paid in full only when you get them right the first time.
intro-4 = On a bench under the arcade roof an old man is feeding pigeons and watching you. Maybe start there.

# Where and when, on the top bar.
setting-where = Tokyo, 1995
setting-type-prompt = Type it in Japanese or rōmaji:

place-shotengai = Shopping Street
place-shotengai-desc = A covered arcade of small shops, bicycles, and an old man on a bench.
place-apartment = Your Room
place-apartment-desc = Six tatami mats, a futon, and a landlady who hears every step.
place-ramen = Ramen Shop
place-ramen-desc = Eight stools at a counter, steam, and an owner who talks while he cooks.
place-konbini = Convenience Store
place-konbini-desc = Bright light, a chime at the door, and rice balls in neat rows.

npc-tanaka = Mr Tanaka
npc-ooya = The landlady
npc-ramen_owner = The ramen owner
npc-clerk = The clerk

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-tanaka-hello = Say hello to the old man
scene-tanaka-hello-start = The old man pats the bench beside him. Stuck? Press [w] to look a word up.
scene-tanaka-hello-end = Mr Tanaka nods, satisfied, and goes back to his pigeons.
scene-tanaka-name = Tell Mr Tanaka your name
scene-tanaka-name-start = Mr Tanaka taps his chest, then points at you.
scene-tanaka-name-end = Mr Tanaka says your name over to himself, twice, as if filing it away.
scene-tanaka-numbers = Count with Mr Tanaka
scene-tanaka-numbers-start = Mr Tanaka holds up his fingers: time to learn to count.

scene-apartment-hello = Meet the landlady
scene-apartment-hello-start = A small woman in an apron opens the door before you knock.
scene-apartment-hello-end = The landlady hands you a key on a wooden tag: the room is yours.
scene-apartment-rent = Talk about rent
scene-apartment-rent-start = The landlady waits in the doorway with a notebook.
scene-apartment-rent-end = The landlady writes 5,000 on a slip of paper and tapes it to your door. It's due every week.

scene-ramen-intro = Ask about work
scene-ramen-intro-start = A man in a white headband waves you in from behind the counter.
scene-ramen-intro-end = The owner ties a towel round your head: you have a job.
scene-ramen-shift = Work a shift
scene-ramen-shift-start = The owner shouts over the noise: fetch drinks, serve them as the orders come in, and chat with him in between.
scene-ramen-shift-end = The last bowl goes out. The owner wipes down the counter and pays you.

scene-konbini-prices = Ask what things cost
scene-konbini-prices-start = The door chimes. A young clerk in a striped uniform bows.
scene-konbini-prices-end = The clerk bows again as you leave. The rice balls are 150 yen.
scene-konbini-buy = Buy something to eat
scene-konbini-buy-start = The clerk waits behind the counter: say what you want, then thank her when she rings it up.
scene-konbini-buy-end = She bags your item and bows. Another sale done.

scene-tanaka-rain = Sit with Mr Tanaka in the rain
scene-tanaka-rain-start = Rain drums on the arcade roof. Mr Tanaka shakes out a black umbrella.
scene-tanaka-rain-end = You leave with Mr Tanaka's umbrella over your head.
scene-ramen-taste = Taste the ramen
scene-ramen-taste-start = The last customer has gone. The owner sets a steaming bowl in front of you.
scene-ramen-taste-end = You drink the soup to the last drop. The owner looks pleased.
scene-apartment-morning = Say good morning to the landlady
scene-apartment-morning-start = The landlady is sweeping the step outside your door.
scene-apartment-morning-end = The landlady goes back to her sweeping, humming.
scene-konbini-lunch = Buy lunch
scene-konbini-lunch-start = The clerk recognises you now and smiles from behind the counter.
scene-konbini-lunch-end = A rice ball and a bottle of tea: lunch.
scene-tanaka-walk = Walk with Mr Tanaka
scene-tanaka-walk-start = Mr Tanaka gets up from his bench, ready for a walk.
scene-tanaka-walk-end = At the corner Mr Tanaka turns off toward the convenience store, waving.
scene-konbini-shift = Work an evening at the store
scene-konbini-shift-start = The clerk hands you a striped apron: help the customers find things and chat while the shop is quiet.
scene-konbini-shift-end = The night clerk arrives. The clerk counts out your pay.

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".
action-fetch = You bring { $item }.
asked-fetch = The owner wanted { $item }.
action-serve = You set down { $count } { $item }s.
asked-serve = The owner wanted { $count } { $item }s.
action-buy = You buy the { $item }.
asked-buy = The clerk asked about { $item }.
action-show = You show where the { $item } is.
asked-show = The customer was looking for the { $item }.
action-hand = You hand over { $count } { $item }s.
asked-hand = The customer wanted { $count } { $item }s.
action-chat = You answered: "{ $topic }"
asked-chat = { $npc } said: "{ $topic }"

# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-hello = { $npc } said hello.
asked-tanaka = Mr Tanaka told you his name.
asked-sit = Mr Tanaka offered you a seat.
asked-bye = { $npc } said goodbye.
asked-ask = Mr Tanaka asked your name.
asked-nice = Mr Tanaka said he's pleased to meet you.
asked-understand = Mr Tanaka asked if you understand Japanese.
asked-numbers = { $npc } asked you to count along.
asked-next = Mr Tanaka wanted the next number: { $number }.
asked-greet = { $npc } said hello.
asked-room = The landlady showed you your room.
asked-key = The landlady gave you the key.
asked-night = The landlady said good night.
asked-rent = The landlady asked if you understand the rent.
asked-amount = The landlady told you the rent.
asked-money = The landlady asked if you have money.
asked-worked = The landlady asked about the ramen job.
asked-welcome = { $npc } welcomed you in.
asked-ate = The owner asked if you've eaten ramen.
asked-work = The owner asked if you'll work.
asked-water = The owner showed you the water.
asked-tea = The owner showed you the tea.
asked-onigiri = The clerk told you what rice balls cost.
asked-bread = The clerk told you what bread costs.
asked-which = The clerk asked which one you meant.
asked-thanks = { $npc } thanked you.
asked-confirm = Mr Tanaka checked your name.
asked-encourage = Mr Tanaka said you do understand.
asked-place = The owner told you what the place is.
asked-weekly = The landlady said how often the rent is due.
asked-price = { $npc } told you the price.
asked-take = The clerk handed it over.
asked-today = Mr Tanaka talked about today's weather.
asked-falling = Mr Tanaka said it's raining.
asked-cold = Mr Tanaka said it's cold.
asked-umbrella = Mr Tanaka asked if you have an umbrella.
asked-lend = Mr Tanaka lent you his umbrella.
asked-want = The owner asked if you want to eat.
asked-taste = The owner asked if it's good.
asked-expensive = The owner asked if it's expensive.
asked-cheap = The owner said it's cheap but good.
asked-drink = The owner offered you tea.
asked-morning = { $npc } said good morning.
asked-job = { $npc } asked about your work.
asked-from = The landlady asked when your work starts.
asked-until = The landlady asked when your work ends.
asked-daily = The landlady said you work every day.
asked-what = The clerk asked what you're buying.
asked-and = The clerk checked your two things.
asked-not = The clerk said that one isn't tea.
asked-total = The clerk told you the total.
asked-again = The clerk asked you to come again.
asked-nihongo = Mr Tanaka asked if you understand Japanese.
asked-going = Mr Tanaka asked where you're going.
asked-konbini = Mr Tanaka said where he's going.
asked-together = Mr Tanaka suggested going together.
asked-home = Mr Tanaka said what he'll do.
asked-walkhome = The clerk suggested walking home together.

# Notebook topics: a word in one of these slot groups is filed under the topic, not the place.
notebook-topic-drinks = Food and drink
notebook-topic-numbers_2_5 = Numbers
notebook-topic-goods = Things
notebook-topic-shelf = Things
