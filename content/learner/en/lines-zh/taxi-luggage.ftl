bags = { -amount(form: "cap") } things, { -way } the taxi!
bags-reply = OK, { -amount } things { -way } the taxi.
bags-reply-intent = Repeat how many, and in or out
bags-rephrase = { -way(form: "cap") } the taxi! { -amount(form: "cap") } of them!

train = { -hour(form: "cap") } o'clock, to Beijing!
train-reply = OK, to Beijing at { -hour }.
train-reply-intent = Repeat the time and where to
train-rephrase = What time? { -hour(form: "cap") } o'clock! To Beijing!

phone = Hello? ... Hang on, I'm on the phone.
phone-reply = You take the call, I'll work!
phone-reply-intent = Tell him to answer it
phone-alt1 = That's too much!
phone-alt1-intent = Say it's too dear
phone-alt2 = How much?
phone-alt2-intent = Ask the price

pay = A good afternoon today! Here's the money.
pay-reply = Thank you, Old Ma!
pay-reply-intent = Thank Old Ma
pay-alt1 = You take the call, I'll work!
pay-alt1-intent = Tell him to answer it
pay-alt2 = How much?
pay-alt2-intent = Ask the price

chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }
chat-a-reply-intent = Answer Old Ma

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }
chat-b-reply-intent = Answer Old Ma
