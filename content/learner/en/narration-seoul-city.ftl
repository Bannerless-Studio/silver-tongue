# The story. intro-1, intro-2, … open a new game ($currency, $wallet, $rent are available).
intro-1 = You fell asleep over a Korean textbook. You wake on a bed that isn't yours, in a room you have never seen, and the noise from the street is nothing like home.
intro-2 = On the desk: someone's ID card, a stack of unopened bills, a wallet with { $currency }{ $wallet } in it. Your own things are gone. Your pockets are empty. The textbook is still in your hand.
intro-3 = Voices pass under the window. You can't understand a word.

# After the last paper on the desk is read (the quiet page's desk).
desk-done = Someone is knocking.
# What each paper lets the player tell once it is read (the quiet page's desk): `paper-<id>-learned`.
paper-idcard-learned = A name: gim min-jun, which he'd spell Kim Min-jun. Not yours.
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
place-campus = University Gate
place-campus-desc = Stone gate posts, a noticeboard thick with flyers, and students hurrying past with armfuls of books.
place-copyshop = Copy Shop
place-copyshop-desc = Two copiers roaring side by side, stacks of warm paper, and a man in a cardigan who never stops moving.

# npc-<id>-unmet: what the player calls someone until a conversation with them is done.
npc-landlady = The landlady
npc-oldman = Grandpa Park
npc-oldman-unmet = The old man
npc-jiwoo = Ji-woo
npc-jiwoo-unmet = The young woman
npc-clerk = The clerk
npc-labmate = Su-jin
npc-copyman = The copy-shop man
npc-creditor = A man in a suit

# Scene names for the menu; scene-<id>-start and scene-<id>-end are optional narration.
scene-room-wake = Answer the door
scene-room-wake-start = You open the door. A woman in slippers, keys in hand, looks past you into the room.
scene-room-wake-end = She points down the alley toward a food stall. Below your window, an old man sits on a bench.

scene-street-hello = Say hello to the old man
scene-street-hello-start = The old man on the bench looks up as you come out, and says something to you.
scene-street-hello-end = You hold out the ID. He recognises the name and points down the alley to the food stall.
scene-street-again = Catch what he said
scene-street-again-start = Back at the bench, he speaks quickly, too fast to catch.
scene-street-again-end = He laughs, pulls you back down onto the bench, and nods at the textbook in your hand.
scene-street-what = Show him your textbook
scene-street-what-start = Grandpa Park taps the book's cover.
scene-street-what-end = He folds his newspaper and nods across the alley at the shop.
scene-street-hungry = Find something to eat
scene-street-hungry-start = Last night's food didn't go far. Your stomach growls, and Grandpa Park hears it and laughs.
scene-street-hungry-end = He points across the alley at the shop, then down it, at a tent with steam rising from it.

scene-shop-prices = Buy some bread
scene-shop-prices-start = A bell over the door. A young clerk looks up from a comic book. Bread and milk sit by the till.
scene-shop-prices-end = He took your five-thousand-won note and dropped one note back in your palm. He's already reading again.
scene-street-numbers = Show Grandpa Park your change
scene-street-numbers-start = Grandpa Park saw it all through the shop window. He's waiting outside the door, and holds out his hand for your change.
scene-street-numbers-end = He holds up your one note, then three fingers, and glares across the alley at the shop.
scene-shop-count = Ask for the rest of your change
scene-shop-count-start = The same clerk, the same comic. You hold up the one note he gave you.
scene-shop-count-end = He doesn't look up again as you leave. Down the alley, steam rises from a tent, and the air smells of something spicy.
scene-shop-buy = Buy something to eat
scene-shop-buy-start = The clerk waves you in without looking up.
scene-shop-buy-end = He bags it without looking up.

scene-stall-intro = Sit down at the stall
scene-stall-intro-start = A young woman in an apron runs the stall alone. Three customers on plastic stools are all calling to her at once.
scene-stall-intro-end = Ji-woo waves your money away, nods at the customers still waiting, and hands you an apron.
scene-stall-shift = Work a shift
scene-stall-shift-start = Customers call their orders over the hiss of the pan.
scene-stall-shift-end = The last customer leaves. Ji-woo counts out your pay from a tin.
scene-stall-family = Take a break with Ji-woo
scene-stall-family-start = Between customers, Ji-woo takes a photo out of her apron pocket.
scene-stall-family-end = She puts the photo away and doesn't take it out again. The face in it looked familiar.

scene-room-rent = See what the landlady wants
scene-room-rent-start = The landlady is waiting outside your door with a ledger.
scene-room-rent-end = The landlady writes 50,000 on a slip of paper and tapes it to your door.

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
asked-friend = The landlady asked if you're Min-jun's friend.
asked-missing = The landlady asked where Min-jun is.
asked-who = The landlady asked who you are.
asked-mistaken = The landlady took you for Min-jun.
asked-name = The landlady didn't catch your name.
asked-bye = { $npc } said goodbye.
asked-hello = { $npc } said hello.
asked-park = Grandpa Park told you his name.
asked-ask = Grandpa Park asked your name.
asked-sit = Grandpa Park offered you a seat.
asked-understand = Grandpa Park asked if you know Korean.
asked-where = Grandpa Park asked where you're going.
asked-book = Grandpa Park asked what you're holding.
asked-good = Grandpa Park said "good".
asked-newspaper = Grandpa Park told you what he's holding.
asked-that = Grandpa Park told you what that is, over there.
asked-hungry = { $npc } asked if you're hungry.
asked-food = Grandpa Park asked if you have any bread.
asked-money = Grandpa Park asked if you have money.
asked-shop = Grandpa Park told you there's bread at the shop.
asked-stall = Grandpa Park pointed out the shop and the snack stall.
asked-go = Grandpa Park sent you on your way.
asked-welcome = { $npc } welcomed you in.
asked-bread = The clerk said there's bread.
asked-milk = The clerk said there's milk too.
asked-total = The clerk put the bread and milk on the counter.
asked-price = The clerk told you the prices.
asked-again = The clerk said the prices again, louder.
asked-slowly = The clerk said the prices slowly.
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
asked-dish = Ji-woo told you what's in the pan.
asked-fed = Ji-woo set a plate in front of you.
asked-jiwoo = Ji-woo told you her name and asked yours.
asked-eat = Ji-woo told you to eat.
asked-tasty = Ji-woo asked if it's good.
asked-work = Ji-woo asked if you'll work with her.
asked-photo = Ji-woo showed you something.
asked-brother = Ji-woo told you about her brother.
asked-paid = The landlady asked if you've paid the rent.
asked-amount = The landlady told you the rent.
asked-week = The landlady told you how often it's due.
asked-march = The landlady told you how far Min-jun had paid.
asked-greet = A customer came in.
asked-thanks = The customer thanked you on the way out.
asked-chat = { $npc } said: "{ $topic }"
action-chat = You answered: "{ $topic }"
action-copy = You hand over { $count } copies of the { $item }.
asked-copy = The student wanted { $count } copies of the { $item }.
asked-look = { $npc } wanted you to look at something.
asked-whose = The landlady said whose letter it is.
asked-from = The landlady said where the letter came from.
asked-student = The landlady said Min-jun is a university student.
asked-uni = The landlady told you where the university is.
asked-sujin = Su-jin told you who she is.
asked-whereis = Su-jin asked where Min-jun is.
asked-since = Su-jin told you since when Min-jun hasn't come.
asked-took = Su-jin told you what Min-jun took.
asked-comeback = { $npc } asked you to come again.
asked-knock = The man asked if Min-jun is in.
asked-borrowed = The man said what Min-jun did.
asked-debt = The man said how much it is.
asked-when = The man asked when Min-jun is coming.
asked-nextweek = The man said when he'll be back.
asked-areyou = The copy-shop man asked if you're a student.
asked-copyshop = The copy-shop man told you what the shop is.
asked-job = The copy-shop man offered you work.
asked-copy-it = The copy-shop man asked you to copy something.
asked-sheets = The copy-shop man asked for two copies.

# Notebook topics: a word in one of these slot groups is filed under the topic, not the place.
notebook-topic-food = Food
notebook-topic-numbers_2_5 = Numbers
notebook-topic-counts = Numbers
notebook-topic-goods = Things
notebook-topic-papers = Things

scene-street-hello-idcard = You show him the ID card.
scene-stall-lead = Follow the lead to the stall
scene-stall-lead-start = A woman is serving an order at the food stall. You ask, “민준 씨?” She nods while finishing the customer’s order.
scene-stall-lead-end = She recognises the name. Her connection to Min-jun is still a question. The old man waves you back to the bench.
scene-street-introductions = Return to the old man's bench
scene-street-introductions-start = You return from the stall. The old man makes room on the bench and introduces himself.
scene-street-introductions-end = Grandpa Park nods at your textbook. As you stand, he gestures toward the alley and speaks in a quick rush.

asked-idcard = The old man recognised Min-jun on the ID.
asked-recognition = The woman acknowledged Min-jun.


# Door experiment: the card is a proper-name sign, not an early food lesson.
paper-stall-card-learned = You sounded out 지우네: Ji-woo’s place. Look for the same heading above the stall.
place-stall-known = Ji-woo’s place
scene-stall-lead-card-read = Above the counter: 지우네. You recognise the heading you decoded and show the matching card. She clears a spot where you can talk while she serves.
scene-stall-lead-card-unread = The sign above the counter has the same Hangul as your card. She turns the card toward the sign so you can compare them. You can sound it out in the Book.
scene-stall-lead-heard-name = You say “지우 씨?” She turns at her name with a warm smile and beckons you beside the counter, close enough to talk while she serves.
scene-stall-lead-id-name = You point to “민준” on the ID. She nods and turns the counter light toward the face so you can talk about him.
scene-stall-lead-quiet-route = You follow the landlady’s pointing hand and hold out the ID. She comes to your side of the counter to see what you need.
scene-stall-lead-decoded = You finish sounding out 지우네. The same heading is above the counter; she sees your recognition and taps the matching sign with a smile.
door-room-wake-call-reply-reaction = She takes a step back from the unfamiliar face.
door-room-wake-call-reply-later = At the door, she leaves a careful gap between you.
door-room-wake-call-alt1-reaction = She looks from you to the name on the ID, then taps it.
door-room-wake-call-alt1-later = Before pointing outside, she taps the ID name once more.
door-room-wake-call-silence-reaction = She waits, then lowers her voice and gives you space.
door-room-wake-call-silence-later = She leaves the door open a little wider so you can follow her pointing hand.
door-room-wake-friend-reply-reaction = She presses a small stall card into your hand. Its heading is 지우네. You tuck it into the Book; open Papers to sound it out.
door-room-wake-friend-reply-later = She checks that the stall card is safely in your Book before pointing down the alley.
door-room-wake-friend-alt1-reaction = She studies you warily, then points down the alley and says “지우 씨.”
door-room-wake-friend-alt1-later = She repeats Ji-woo’s name for you as she points toward the stall.
door-room-wake-friend-alt2-reaction = She nods at the name on the ID, then points down the alley.
door-room-wake-friend-alt2-later = She traces the route from the ID in your hand to the stall with her finger.
door-room-wake-friend-silence-reaction = She does not press you to explain. She turns and points down the alley.
door-room-wake-friend-silence-later = She waits at the doorway until you have seen which stall she means.
door-room-wake-missing-reply-reaction = Her shoulders drop. She points outside: another person may know.
door-room-wake-missing-reply-later = She sends you to the stall to ask for help finding Min-jun.
door-room-wake-missing-alt1-reaction = She lifts an eyebrow at your claim, then points firmly toward the stall.
door-room-wake-missing-alt1-later = She sends you to the stall expecting you to explain that friendship yourself.
door-room-wake-missing-alt2-reaction = She follows your glance, then draws your attention back to the alley.
door-room-wake-missing-alt2-later = She watches the alley as though you might lead her to Min-jun.
door-room-wake-missing-silence-reaction = She lets the unanswered question rest and gestures toward the stall.
door-room-wake-missing-silence-later = She closes the conversation gently, leaving you with the stall as your next lead.
door-street-hello-hello-reply-reaction = The old man returns your greeting with a small bow.
door-street-hello-hello-reply-later = As you leave, he gives you another little bow.
door-street-hello-hello-alt1-reaction = He lowers his raised hand, then gives you room to approach.
door-street-hello-hello-alt1-later = He points from a step farther away, respecting the space you asked for.
door-street-hello-hello-alt2-reaction = He leans forward at the name, looking for what you are holding.
door-street-hello-hello-alt2-later = He follows the ID with his eyes as you turn toward the stall.
door-street-hello-hello-silence-reaction = He leaves his greeting hanging and offers an open palm instead.
door-street-hello-hello-silence-later = He uses his whole arm to show the route, without waiting for more words.
door-street-hello-idcard-reply-reaction = He nods at your confirmation and points directly to the stall.
door-street-hello-idcard-reply-later = He points confidently to the woman behind the stall counter.
door-street-hello-idcard-alt1-reaction = He turns the ID upright to check the name, then points to the stall anyway.
door-street-hello-idcard-alt1-later = He points to the stall but keeps a questioning look on the name you denied.
door-street-hello-idcard-alt2-reaction = He notices your uncertainty and draws the short route in the air.
door-street-hello-idcard-alt2-later = He watches until you have found the stall he carefully showed you.
door-street-hello-idcard-silence-reaction = He reads the ID for himself and turns it toward the stall.
door-street-hello-idcard-silence-later = He holds his pointing hand still until you begin walking.
door-stall-lead-recognition-reply-reaction = She nods back and clears a space at the counter for you.
door-stall-lead-recognition-reply-later = She leaves that space clear for your next visit.
door-stall-lead-recognition-alt1-reaction = She pauses at your refusal and moves her hands away from your things.
door-stall-lead-recognition-alt1-later = She leaves your things untouched and lets you choose when to approach again.
door-stall-lead-recognition-alt2-reaction = She sees your uncertainty and places the ID beside the stall sign.
door-stall-lead-recognition-alt2-later = She keeps the sign in view so you can use it when you return.
door-stall-lead-recognition-silence-reaction = She gives you time, setting a cup down without asking another question.
door-stall-lead-recognition-silence-later = She leaves the cup by the counter as a quiet invitation to return.
door-street-introductions-park-reply-reaction = Park smiles at hearing his name in your greeting.
door-street-introductions-park-reply-later = He waves you back using the same small bow you greeted him with.
door-street-introductions-park-alt1-reaction = At Min-jun’s name, Park glances toward the stall.
door-street-introductions-park-alt1-later = He keeps the stall in sight while you talk.
door-street-introductions-park-alt2-reaction = Park rests his hands in his lap and gives you more space.
door-street-introductions-park-alt2-later = He leaves an extra space between you on the bench.
door-street-introductions-park-silence-reaction = Park introduces himself with a hand to his chest and waits.
door-street-introductions-park-silence-later = He touches his chest again when he catches your eye.
door-street-introductions-who-reply-reaction = Park repeats your name softly, testing its sound.
door-street-introductions-who-reply-later = He gives you a nod of recognition as you get up.
door-street-introductions-who-alt1-reaction = Park compares you with the face on the ID and raises an eyebrow.
door-street-introductions-who-alt1-later = He looks once more at the ID before accepting your departure.
door-street-introductions-who-alt2-reaction = Park gestures from himself toward the stall at your question.
door-street-introductions-who-alt2-later = He points out the stall again as a person you can ask about Min-jun.
door-street-introductions-who-silence-reaction = Park lets the question pass and gestures to the bench.
door-street-introductions-who-silence-later = He leaves the question of your name open when you stand.
door-street-introductions-ask-reply-reaction = Park nods and mouths your name once more.
door-street-introductions-ask-reply-later = He practises your name under his breath as you leave.
door-street-introductions-ask-alt1-reaction = Park tilts the ID toward you, checking the name you gave.
door-street-introductions-ask-alt1-later = He sets the ID between you before you stand, leaving the puzzle visible.
door-street-introductions-ask-alt2-reaction = Park accepts the connection you offer with a thoughtful nod.
door-street-introductions-ask-alt2-later = He looks toward the stall as though your friendship explains the visit.
door-street-introductions-ask-silence-reaction = Park stops asking and slides aside to leave you a seat.
door-street-introductions-ask-silence-later = He gives you a farewell nod without trying to name you.
door-street-introductions-sit-reply-reaction = Park pats the free part of the bench at your thanks.
door-street-introductions-sit-reply-later = He leaves your spot on the bench clear when you get up.
door-street-introductions-sit-alt1-reaction = Park points toward the stall, then back to the empty seat.
door-street-introductions-sit-alt1-later = He sends one last glance toward the stall before you go.
door-street-introductions-sit-alt2-reaction = Park taps his own chest, smiling at your question.
door-street-introductions-sit-alt2-later = He touches his chest in farewell so you can recognise him next time.
door-street-introductions-sit-silence-reaction = Park shifts his coat to make room without asking again.
door-street-introductions-sit-silence-later = He keeps his coat tucked away to leave you room for another visit.
door-street-introductions-understand-reply-reaction = Park slows down and adds gestures to his words.
door-street-introductions-understand-reply-later = He uses a broad gesture with his next quick question, remembering your uncertainty.
door-street-introductions-understand-alt1-reaction = Park nods at your confidence and keeps his usual speaking pace.
door-street-introductions-understand-alt1-later = His next question comes at the everyday pace your confident answer invited.
door-street-introductions-understand-alt2-reaction = Park smiles at your thanks and gives you a moment to gather your words.
door-street-introductions-understand-alt2-later = He waits a beat before his next question, leaving you time to answer.
door-street-introductions-understand-silence-reaction = Park stops testing you and speaks with his hands instead.
door-street-introductions-understand-silence-later = He points along the alley with his next question rather than expecting an answer.
door-street-introductions-bye-reply-reaction = Park raises a hand as you say goodbye.
door-street-introductions-bye-reply-later = He holds that farewell wave until you turn into the alley.
door-street-introductions-bye-alt1-reaction = Park nods at your answer, then raises his hand to let you go.
door-street-introductions-bye-alt1-later = He sends you off with an approving nod at your continued confidence.
door-street-introductions-bye-alt2-reaction = Park gives you a reassuring smile and lets the conversation end.
door-street-introductions-bye-alt2-later = He waves gently, remembering that you said you did not understand.
door-street-introductions-bye-silence-reaction = Park notices you standing and offers a wordless wave.
door-street-introductions-bye-silence-later = He keeps the farewell quiet as you walk away.
