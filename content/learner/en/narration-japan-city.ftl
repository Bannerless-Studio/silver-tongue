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

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "tea", $count = "three".

# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-hello = { $npc } was saying hello.
asked-tanaka = Mr Tanaka was telling you his name.
asked-sit = Mr Tanaka was offering you a seat.
asked-bye = { $npc } was saying goodbye.
