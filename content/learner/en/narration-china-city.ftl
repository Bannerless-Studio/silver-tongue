# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = Your phone is dead, your wallet is gone, and the bus that brought you here left an hour ago.
intro-2 = You're standing on a street in a Chinese city with { $currency }{ $wallet } in your pocket. You know nobody, and nobody here speaks your language.
intro-3 = Food costs money. Rent is { $currency }{ $rent }, due at the end of the week. To earn anything you'll need work, and for work you'll need words.
intro-4 = On a bench by the road, an old man is watching you with open curiosity. Maybe start there.

place-street = Main Street
place-street-desc = Bikes, steam and shouting. An old man sits on a bench by the road. Across it, a noodle shop glows.
place-noodle_shop = Noodle Shop
place-noodle_shop-desc = Steam everywhere. The cook is shouting orders at nobody in particular.

npc-wang = Old Wang
npc-cook = Cook

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-street-hello = Meet Old Wang
scene-street-hello-start = The old man pats the bench beside him and points at himself. He seems to have decided you need lessons: he says something, you answer. Stuck? Press [w] to look words up, and [s] there to see what the whole sentence means.
scene-street-hello-end = Old Wang looks delighted with his new student. He repeats your name a few times, getting it a little wrong each time, and seems very pleased about it.

scene-street-hungry = Talk about food
scene-street-hungry-start = Your stomach growls, loudly. Old Wang raises an eyebrow.
scene-street-hungry-end = Old Wang points at the noodle shop, then at you, then mimes rolling up his sleeves. Work first, noodles after.

scene-street-practice = Practise greetings
scene-street-practice-start = Old Wang shuffles over to make room. Another lesson, then.
scene-street-practice-end = Old Wang nods, satisfied, and goes back to watching the street.

scene-noodle-intro = Ask about work
scene-noodle-intro-start = The cook looks you up and down, wiping her hands on her apron. So this is Old Wang's latest project.
scene-noodle-intro-end = She throws you an apron. You have a job, sort of.

scene-noodle-shift = Work a shift
scene-noodle-shift-start = Orders fly across the counter. Keep up.
scene-noodle-shift-end = The rush dies down. The cook counts coins into your hand.

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".
action-fetch = You bring { $item }.
asked-fetch = They wanted { $item }.
action-serve = You set down { $count } cups of { $item }.
asked-serve = They wanted { $count } cups of { $item }.
