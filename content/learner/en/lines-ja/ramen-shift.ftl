welcome = Welcome! (to a customer coming in)
welcome-reply = Welcome!
welcome-reply-intent = Call out the welcome too

drink ={ -item(form: "cap") }!
drink-reply = Yes, { -item }.
drink-reply-intent = Confirm the drink

chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }
chat-a-reply-intent = Answer him

order = { -count(form: "cap") } { -item }s, please!
order-reply = Yes, { -count } { -item }s.
order-reply-intent = Confirm the order
order-rephrase = { -item(form: "cap") }. { -count(form: "cap") }.

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }
chat-b-reply-intent = Answer him

chat-c = { -topic }
chat-c-reply = { -topic(form: "reply") }
chat-c-reply-intent = Answer him

chat-d = { -topic }
chat-d-reply = { -topic(form: "reply") }
chat-d-reply-intent = Answer him
