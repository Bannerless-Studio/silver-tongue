drink = { -item(form: "cap") }.
drink-reply = OK, { -item }.
drink-reply-intent = Repeat the drink

order = { -count(form: "cap") } cups of { -item }.
order-reply = OK, { -count } cups of { -item }.
order-reply-intent = Repeat the order
order-rephrase = { -item(form: "cap") }. { -count(form: "cap") } cups.

chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }
chat-a-reply-intent = Answer Xiao Zhang

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }
chat-b-reply-intent = Answer Xiao Zhang

chat-c = { -topic }
chat-c-reply = { -topic(form: "reply") }
chat-c-reply-intent = Answer Xiao Zhang

chat-d = { -topic }
chat-d-reply = { -topic(form: "reply") }
chat-d-reply-intent = Answer Xiao Zhang
