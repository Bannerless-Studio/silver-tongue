# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = You fell asleep over a Korean textbook. You wake on a bed that isn't yours, in a room you have never seen, and the noise from the street is nothing like home.
intro-2 = On the desk: someone's ID card, a stack of unopened bills, a wallet with { $currency }{ $wallet } in it. Your own things are gone. Your pockets are empty. The textbook is still in your hand.
intro-3 = Voices pass under the window. You can't understand a word.

# After the last paper on the desk is read (the quiet page's desk).
desk-done = Someone is knocking.

# Where and when, on the top bar.
setting-where = Seoul, 2000

place-room = The Room
# The room's name once the ID card on the desk has been read (the quiet page's desk).
place-room-known = Min-jun's Room
place-room-desc = A narrow rented room: a mattress, a desk of heavy books, and bills nobody has opened.
place-street = The Alley
place-street-desc = A steep alley of shops and hanging wires, and an old man on a bench.
place-stall = Snack Stall
place-stall-desc = A tent over a steaming pan of tteokbokki, a few plastic stools, and a young woman who talks while she cooks.
place-shop = Corner Shop
place-shop-desc = Shelves to the ceiling, a humming fridge, and a clerk who counts change fast.
place-campus = University Gate
place-campus-desc = Stone gate posts, a noticeboard thick with flyers, and students hurrying past with armfuls of books.
place-copyshop = Copy Shop
place-copyshop-desc = Two copiers roaring side by side, stacks of warm paper, and a man in a cardigan who never stops moving.

npc-landlady = The landlady
npc-oldman = Grandpa Park
npc-jiwoo = Ji-woo
npc-clerk = The clerk
npc-labmate = Su-jin
npc-copyman = The copy-shop man
npc-creditor = A man in a suit

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-room-wake = Answer the door
scene-room-wake-start = The knocking gets louder. A woman in slippers, keys in hand: the landlady. Stuck? Press [w] to look a word up.
scene-room-wake-end = The landlady looks you up and down, then at the room behind you, and goes back downstairs without another word.

scene-street-hello = Say hello to the old man
scene-street-hello-start = An old man on a bench outside the shops pats the seat beside him.
scene-street-hello-end = Grandpa Park nods, satisfied, and goes back to watching the alley.
scene-street-numbers = Count with Grandpa Park
scene-street-numbers-start = Grandpa Park holds up his fingers: time to learn to count.
scene-street-hungry = Ask Grandpa Park about food
scene-street-hungry-start = Your stomach growls. Grandpa Park hears it and laughs.
scene-street-hungry-end = He points down the alley at a tent with steam rising from it.

scene-stall-intro = Visit the snack stall
scene-stall-intro-start = A young woman in an apron looks up from a pan of red rice cakes.
scene-stall-intro-end = Ji-woo waves away your thanks. She hands you an apron instead: you start tomorrow.
scene-stall-shift = Work a shift
scene-stall-shift-start = Ji-woo calls the orders over the hiss of the pan: bring what she asks for, as many as she asks.
scene-stall-shift-end = The last customer leaves. Ji-woo counts out your pay from a tin.
scene-stall-family = Ask about the photo
scene-stall-family-start = Between customers, Ji-woo takes a photo out of her apron pocket.
scene-stall-family-end = She puts the photo away and doesn't take it out again. The face in it looked familiar.

scene-room-rent = Talk about rent
scene-room-rent-start = The landlady is waiting outside your door with a ledger.
scene-room-rent-end = The landlady writes 50,000 on a slip of paper and tapes it to your door. It's due every week.

scene-shop-prices = Ask what things cost
scene-shop-prices-start = A bell over the door. A young clerk looks up from a comic book. You want milk and bread.
scene-shop-prices-end = A thousand won for the milk and a thousand for the bread. Next time you count before you pay.
scene-shop-buy = Buy something to eat
scene-shop-buy-start = The clerk waits behind the counter: say what you want, then take your leave.
scene-shop-buy-end = He bags it without looking up. You count your change this time.

scene-room-letter = Take the letter
scene-room-letter-start = The landlady is at the door again, an envelope held out between two fingers.
scene-room-letter-end = The envelope has a university crest on it, and Min-jun's name. Inside: a single typed page you can't read yet.
scene-campus-labmate = Talk to the student at the gate
scene-campus-labmate-start = A young woman with a stack of folders is watching the gate. She looks twice at you, then walks over.
scene-campus-labmate-end = Su-jin goes back through the gate without looking round.
scene-room-creditor = Answer the knock
scene-room-creditor-start = Three hard knocks. A man in a suit fills the doorway, looking past you into the room.
scene-room-creditor-end = He writes something in a little notebook and goes down the stairs slowly, as if he has all the time in the world.
scene-copy-intro = Look in at the copy shop
scene-copy-intro-start = The man at the copiers waves you in over the noise.
scene-copy-intro-end = He hands you a stack of paper still warm from the machine. You start tomorrow.
scene-copy-shift = Work at the copy shop
scene-copy-shift-start = Students come in with books, letters and photos: copy what they ask for, as many as they ask.
scene-copy-shift-end = The copiers go quiet. The copy-shop man counts out your pay.

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
asked-friend = { $npc } asked if you're Min-jun's friend.
asked-room = The landlady said this is Min-jun's room.
asked-here = The landlady said this room is Min-jun's.
asked-who = { $npc } asked who you are.
asked-bye = { $npc } said goodbye.
asked-hello = { $npc } said hello.
asked-park = Grandpa Park told you his name.
asked-sit = Grandpa Park offered you a seat.
asked-numbers = Grandpa Park asked you to count along.
asked-got = Grandpa Park asked if you've got it.
asked-korean = Grandpa Park asked if you know Korean.
asked-next = Grandpa Park wanted the next number: { $number }.
asked-hungry = { $npc } asked if you're hungry.
asked-money = Grandpa Park asked if you have money.
asked-none = Grandpa Park asked if you have no money.
asked-there = Grandpa Park pointed at a snack stall.
asked-stall = Grandpa Park told you there's a snack stall over there.
asked-go = Grandpa Park sent you on your way.
asked-welcome = { $npc } welcomed you in.
asked-jiwoo = Ji-woo told you her name and asked yours.
asked-eat = Ji-woo told you to eat.
asked-ok = Ji-woo said it's all right.
asked-eomuk = Ji-woo told you there's fish cake too.
asked-tteok = Ji-woo asked if you'll have tteokbokki.
asked-greet = A customer came in.
asked-chat = { $npc } said: "{ $topic }"
action-chat = You answered: "{ $topic }"
asked-thanks = The customer thanked you on the way out.
asked-gimbap = Ji-woo told you what else she sells.
asked-work = Ji-woo asked if you'll work tomorrow.
asked-photo = Ji-woo showed you a photo.
asked-brother = Ji-woo told you about her brother.
asked-paid = The landlady asked if you've paid the rent.
asked-amount = The landlady told you the rent.
asked-week = The landlady told you how often it's due.
asked-march = The landlady told you how far Min-jun had paid.
asked-milk = The clerk told you what milk costs.
asked-bread = The clerk told you what bread costs.
asked-want = The clerk asked what you want.
asked-prices = The clerk told you what milk and bread cost.
asked-total = The clerk asked for three thousand won.
action-copy = You hand over { $count } copies of the { $item }.
asked-copy = The student wanted { $count } copies of the { $item }.
asked-look = { $npc } wanted you to look at something.
asked-whose = The landlady said whose letter it is.
asked-from = The landlady said where the letter came from.
asked-student = The landlady said Min-jun is a university student.
asked-uni = The landlady told you where the university is.
asked-sujin = Su-jin told you who she is.
asked-where = Su-jin asked where Min-jun is.
asked-since = Su-jin told you since when Min-jun hasn't come.
asked-took = Su-jin told you what Min-jun took.
asked-again = { $npc } asked you to come again.
asked-knock = The man asked if Min-jun is in.
asked-borrowed = The man said what Min-jun did.
asked-debt = The man said how much it is.
asked-when = The man asked when Min-jun is coming.
asked-nextweek = The man said when he'll be back.
asked-areyou = The copy-shop man asked if you're a student.
asked-shop = The copy-shop man told you what the shop is.
asked-job = The copy-shop man offered you work.
asked-copy-it = The copy-shop man asked you to copy something.
asked-sheets = The copy-shop man asked for two copies.

# Notebook topics: a word in one of these slot groups is filed under the topic, not the place.
notebook-topic-food = Food
notebook-topic-numbers_2_5 = Numbers
notebook-topic-counts = Numbers
notebook-topic-goods = Things
notebook-topic-papers = Things
