# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = You fell asleep over a Korean textbook. You wake on a bed that isn't yours, in a room you have never seen, and the noise from the street is nothing like home.
intro-2 = On the desk: someone's ID card, a stack of unopened bills, a wallet with { $currency }{ $wallet } in it. Your own things are gone. Your pockets are empty. The textbook is still in your hand.
intro-3 = Voices pass under the window. You can't understand a word.

# After the last paper on the desk is read (the quiet page's desk).
desk-done = Someone is knocking.
# What each paper lets the player tell once it is read (the quiet page's desk): `paper-<id>-learned`.
paper-idcard-learned = A name: Kim Min-jun. Not yours. This must be his room.
paper-newspaper-learned = A newspaper from Seoul. The date on it: the year 2000.
paper-bill-learned = A bill. 50,000 won, unpaid.

# Where and when, on the top bar.
setting-where = Seoul, 2000

place-room = The Room
# The room's name once the ID card on the desk has been read (the quiet page's desk).
place-room-known = Min-jun's Room
# place-<id>-desc: what the player sees on first standing there (the quiet page: before any scene there).
# place-<id>-go: the way there, worded from what the player has seen ("Go to <place>" without it).
place-room-desc = A narrow rented room: a mattress, a desk of heavy books, and bills nobody has opened.
place-room-go = Go back up to the room
place-street = The Alley
place-street-desc = A steep alley of little shops and hanging wires, and the old man on his bench.
place-street-go = Go outside
place-stall = Snack Stall
place-stall-desc = A tent over a steaming pan of something red, and a few plastic stools.
place-stall-go = Go down the alley to the stall
place-shop = Corner Shop
place-shop-desc = Shelves to the ceiling and a humming fridge.
place-shop-go = Go into the shop

# npc-<id>-unmet: what the player calls someone until a conversation with them is done.
npc-landlady = The landlady
npc-oldman = Grandpa Park
npc-oldman-unmet = The old man
npc-jiwoo = Ji-woo
npc-jiwoo-unmet = The young woman
npc-clerk = The clerk

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-room-wake = Answer the door
scene-room-wake-start = The knocking gets louder. A woman in slippers, keys in hand: the landlady.
scene-room-wake-end = The landlady looks you up and down, then at the room behind you, and goes back downstairs without another word. Below the window, an old man on a bench is looking up at you.

scene-street-hello = Say hello to the old man
scene-street-hello-start = The old man pats the seat beside him and says something to you.
scene-street-hello-end = Grandpa Park nods, satisfied. Then he leans over and asks you something else, fast.
scene-street-again = Catch what he said
scene-street-again-start = He says it again, just as fast. You catch nothing.
scene-street-again-end = He laughs, pats your knee, and nods at the textbook in your hand.
scene-street-what = Show him your textbook
scene-street-what-start = Grandpa Park taps the book's cover.
scene-street-what-end = He folds his newspaper and nods across the alley at the shop.
scene-street-hungry = Find something to eat
scene-street-hungry-start = Your stomach growls. Grandpa Park hears it and laughs.
scene-street-hungry-end = He points across the alley at the shop, then down it, at a tent with steam rising from it.

scene-shop-prices = Buy some bread
scene-shop-prices-start = A bell over the door. A young clerk looks up from a comic book. Bread and milk sit by the till.
scene-shop-prices-end = He took your five-thousand-won note and dropped one note back in your palm. He's already reading again.
scene-street-numbers = Show Grandpa Park your change
scene-street-numbers-start = Grandpa Park is waiting outside the shop door. He holds out his hand for your change.
scene-street-numbers-end = He holds up your one note, then three fingers, and glares across the alley at the shop.
scene-shop-count = Ask for the rest of your change
scene-shop-count-start = The same clerk, the same comic. You hold up the one note he gave you.
scene-shop-count-end = He doesn't look up again as you leave. Down the alley, steam rises from a tent, and the air smells of something spicy.
scene-shop-buy = Buy something to eat
scene-shop-buy-start = The clerk waves you in without looking up.
scene-shop-buy-end = He bags it without looking up.

scene-stall-intro = Sit down at the stall
scene-stall-intro-start = A young woman in an apron runs the stall alone. Three customers wait on plastic stools.
scene-stall-intro-end = Ji-woo waves your money away and hands you an apron.
scene-stall-shift = Work a shift
scene-stall-shift-start = Ji-woo calls the orders over the hiss of the pan.
scene-stall-shift-end = The last customer leaves. Ji-woo counts out your pay from a tin.
scene-stall-family = Take a break with Ji-woo
scene-stall-family-start = Between customers, Ji-woo takes a photo out of her apron pocket.
scene-stall-family-end = She puts the photo away and doesn't take it out again. The face in it looked familiar.

scene-room-rent = See what the landlady wants
scene-room-rent-start = The landlady is waiting outside your door with a ledger.
scene-room-rent-end = The landlady writes 50,000 on a slip of paper and tapes it to your door.

# What a reply does (action-<name>), and on a mix-up what was asked (asked-<name>).
# Concept values arrive as learner names: $item = "gimbap", $count = "three".
action-fetch = You bring { $item }.
asked-fetch = Ji-woo wanted { $item }.
action-serve = You set down { $count } { $item }.
asked-serve = Ji-woo wanted { $count } { $item }.
action-buy = You buy the { $item }.
asked-buy = The clerk asked about { $item }.

# Conversations: what was asked, shown after a wrong reply. These are shared by every scene that
# uses the action, so they say "they" unless only one person ever uses it.
asked-call = The landlady called for Min-jun.
asked-friend = The landlady asked if you're Min-jun's friend.
asked-room = The landlady said this is Min-jun's room.
asked-who = The landlady asked who you are.
asked-bye = { $npc } said goodbye.
asked-hello = { $npc } said hello.
asked-park = Grandpa Park told you his name.
asked-ask = Grandpa Park asked your name.
asked-sit = Grandpa Park offered you a seat.
asked-understand = Grandpa Park asked if you know Korean.
asked-where = Grandpa Park asked where you're going.
asked-book = Grandpa Park told you what you're holding.
asked-quiz = Grandpa Park asked what this is.
asked-good = Grandpa Park said "good", and held up his newspaper.
asked-newspaper = Grandpa Park told you what he's holding.
asked-that = Grandpa Park told you what that is, over there.
asked-hungry = { $npc } asked if you're hungry.
asked-food = Grandpa Park asked if you have any bread.
asked-shop = Grandpa Park told you there's bread at the shop.
asked-stall = Grandpa Park pointed out the shop and the snack stall.
asked-go = Grandpa Park sent you on your way.
asked-welcome = { $npc } welcomed you in.
asked-milk = The clerk said there's milk too.
asked-price = The clerk told you the prices.
asked-again = The clerk said the prices again, louder.
asked-change = The clerk gave you your change.
asked-claim = The clerk asked what you want.
asked-refund = The clerk counted two notes into your hand.
asked-sorry = The clerk said sorry.
asked-cost = Grandpa Park asked what the bread and milk cost.
asked-note = Grandpa Park held up your change: one note.
asked-numbers = Grandpa Park asked you to count along.
asked-owed = Grandpa Park said: three thousand won.
asked-next = Grandpa Park wanted the next number: { $number }.
asked-count = The clerk counted out your change.
asked-jiwoo = Ji-woo told you her name and asked yours.
asked-eat = Ji-woo told you to eat.
asked-tasty = Ji-woo asked if it's good.
asked-work = Ji-woo asked if you'll work tomorrow.
asked-photo = Ji-woo showed you something.
asked-brother = Ji-woo told you about her brother.
asked-paid = The landlady asked if you've paid the rent.
asked-amount = The landlady told you the rent.
asked-week = The landlady told you how often it's due.
asked-march = The landlady told you how far Min-jun had paid.

# Notebook topics: a word in one of these slot groups is filed under the topic, not the place.
notebook-topic-food = Food
notebook-topic-numbers_2_5 = Numbers
notebook-topic-counts = Numbers
notebook-topic-goods = Things
