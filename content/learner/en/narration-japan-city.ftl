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
scene-ramen-shift-start = The owner shouts over the noise: fetch drinks, then serve them as the orders come in.
scene-ramen-shift-end = The last bowl goes out. The owner wipes down the counter and pays you.

scene-konbini-prices = Ask what things cost
scene-konbini-prices-start = The door chimes. A young clerk in a striped uniform bows.
scene-konbini-prices-end = The clerk bows again as you leave. The rice balls are 150 yen.
scene-konbini-buy = Buy something to eat
scene-konbini-buy-start = The clerk waits behind the counter: say what you want, then thank her when she rings it up.
scene-konbini-buy-end = She bags your item and bows. Another sale done.

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".
action-fetch = You bring { $item }.
asked-fetch = The owner wanted { $item }.
action-serve = You set down { $count } { $item }s.
asked-serve = The owner wanted { $count } { $item }s.
action-buy = You buy the { $item }.
asked-buy = The clerk asked about { $item }.

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

# Notebook topics: a word in one of these slot groups is filed under the topic, not the place.
notebook-topic-drinks = Food and drink
notebook-topic-numbers_2_5 = Numbers
notebook-topic-goods = Things
