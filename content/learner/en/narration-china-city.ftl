# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = Your phone is dead, your wallet is gone, and the bus that brought you here left an hour ago.
intro-2 = You're standing on a street in a Chinese city with { $currency }{ $wallet } in your pocket. You know nobody, and nobody here speaks your language.
intro-3 = Food costs money. There's a room for you down the street, and the rent, { $currency }{ $rent }, is due at the end of each week. To earn anything you'll need work, and for work you'll need words.
intro-4 = On a bench by the road, an old man is watching you with open curiosity. Maybe start there.

place-street = Main Street
place-street-desc = Bikes, steam and shouting. An old man sits on a bench by the road. Across it, a noodle shop glows, and past it the street opens onto a market.
place-noodle_shop = Noodle Shop
place-noodle_shop-desc = Steam everywhere. The cook is shouting orders at nobody in particular.
place-room = Your Room
place-room-desc = A narrow bed and a window onto the street. The landlord seems to hear every step on the stairs.
place-market = Market Street
place-market-desc = Stalls, scooters and a warehouse with its doors wide open. Your room is up the stairs above a shuttered shop.
place-warehouse = Warehouse
place-warehouse-desc = Stacks of tables and chairs, and a big man with a clipboard.

npc-wang = Old Wang
npc-cook = Cook
npc-landlord = Mr Li
npc-foreman = Big Liu

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-street-hello = Meet Old Wang
scene-street-hello-start = The old man pats the bench beside him and points at himself. He seems to have decided you need lessons: he says something, you answer. Stuck? Press [w] to look words up, and [s] there to see what the whole sentence means.
scene-street-hello-end = Old Wang looks delighted with his new student. He repeats your name a few times, getting it a little wrong each time, and seems very pleased about it.

scene-street-hungry = Talk about food
scene-street-hungry-start = Your stomach growls, loudly. Old Wang raises an eyebrow.
scene-street-hungry-end = Old Wang points at the noodle shop, then at you, then holds up his fingers one by one. Work first, noodles after, and counting before either.

scene-street-practice = Practise greetings
scene-street-practice-start = Old Wang shuffles over to make room. Another lesson, then.
scene-street-practice-end = Old Wang nods, satisfied, and goes back to watching the street.

scene-street-numbers = Count with Old Wang
scene-street-numbers-start = Old Wang holds up one finger, then another. Anyone who works at the noodle shop has to count, and he means to make sure you can.
scene-street-numbers-end = Old Wang makes you count on your own fingers, twice, just to be sure. Now the noodle shop.

scene-noodle-intro = Ask about work
scene-noodle-intro-start = The cook looks you up and down, wiping her hands on her apron. So this is Old Wang's latest project.
scene-noodle-intro-end = She throws you an apron. You have a job, sort of.

scene-noodle-shift = Work a shift
scene-noodle-shift-start = Orders fly across the counter. Keep up.
scene-noodle-shift-end = The rush dies down. The cook counts coins into your hand.

scene-room-hello = Meet the landlord
scene-room-hello-start = A thin man in slippers opens the door before you knock. He has clearly been expecting you.
scene-room-hello-end = Mr Li hands you a key on a red string, and points firmly at the bed. You'll sleep here.

scene-warehouse-intro = Ask about work
scene-warehouse-intro-start = The big man with the clipboard looks up. He holds up five fingers, then all ten, and raises an eyebrow: can you count that far?
scene-warehouse-intro-end = Big Liu writes something on his clipboard, possibly your name. There's work here whenever you want it.

scene-warehouse-shift = Carry furniture
scene-warehouse-shift-start = A truck backs up to the doors. Big Liu reads from his clipboard; you do the lifting.
scene-warehouse-shift-end = The truck pulls away. Big Liu counts out your pay, twice.

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".
action-fetch = You bring { $item }.
asked-fetch = They wanted { $item }.
action-serve = You set down { $count } cups of { $item }.
asked-serve = They wanted { $count } cups of { $item }.
action-carry = You carry { $amount } { $item }s.
asked-carry = They wanted { $amount } { $item }s.
action-pick = You pick up the { $size } { $item }.
asked-pick = They wanted the { $size } { $item }.

# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-hello = They were saying hello.
asked-greet = They were saying hello.
asked-wang = They were telling you their name.
asked-how = They wanted to know how you are.
asked-name = They were telling you what to call them.
asked-ask = They wanted your name.
asked-names = They told you their name and wanted yours.
asked-bye = They were saying goodbye.
asked-farewell = They were saying goodbye.
asked-answer = They said "{ $said }" and wanted the usual answer.
asked-hungry = They asked how you are, and your stomach has an answer.
asked-noodles = They were offering you noodles.
asked-like = They wanted to know if you like noodles.
asked-there = They were pointing somewhere.
asked-shop = They were telling you there's a restaurant over there.
asked-zhang = They said a name.
asked-friend = They were telling you about a friend.
asked-job = They were offering you work.
asked-live = They were telling you this room is yours.
asked-numbers = They wanted you to count along.
asked-next = They wanted the next number: { $number }.
asked-foreman = They were telling you their name.
