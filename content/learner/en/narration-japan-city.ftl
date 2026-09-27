# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = Tokyo, 1995. Your bag was stolen on the first night, with your passport in it, and the embassy says a new one takes weeks. There is no phone in your pocket and nobody on this street speaks your language: whatever you have to say, you will say it in Japanese.
intro-2 = You have { $currency }{ $wallet }. A landlady down the street has a room; the rent, { $currency }{ $rent }, falls due at the end of each week, and food costs money every day.
intro-3 = The ramen shop is short of hands. It needs words, and words get you paid in full only when you get them right the first time.
intro-4 = On a bench under the arcade roof an old man is feeding pigeons and watching you. Maybe start there.

place-shotengai = Shopping Street
place-shotengai-desc = A covered arcade of small shops, bicycles, and an old man on a bench.
place-apartment = Your Room
place-apartment-desc = Six tatami mats, a futon, and a landlady who hears every step.
place-ramen = Ramen Shop
place-ramen-desc = Eight stools at a counter, steam, and an owner who talks while he cooks.
place-konbini = Convenience Store
place-konbini-desc = Bright light, a chime at the door, and rice balls in neat rows.

npc-tanaka = Mr Tanaka
npc-ooya = the landlady
npc-ramen_owner = the ramen owner
npc-clerk = the clerk

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-tanaka-hello = Say hello to the old man
scene-tanaka-hello-start = The old man pats the bench beside him.
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

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".

# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-hello = { $npc } was saying hello.
asked-tanaka = Mr Tanaka was telling you his name.
asked-sit = Mr Tanaka was offering you a seat.
asked-bye = { $npc } was saying goodbye.
asked-ask = Mr Tanaka was asking your name.
asked-nice = Mr Tanaka was saying he's pleased to meet you.
asked-understand = Mr Tanaka was asking if you understand Japanese.
asked-numbers = { $npc } asked you to count along.
asked-next = Mr Tanaka wanted the next number: { $number }.
asked-greet = { $npc } was saying hello.
asked-room = The landlady was showing you your room.
asked-key = The landlady was giving you the key.
asked-night = The landlady was saying good night.
asked-rent = The landlady was asking if you understand about the rent.
asked-amount = The landlady was telling you the rent.
asked-money = The landlady was asking if you have money.
asked-worked = The landlady was asking if you've worked at the ramen shop.
