greet = Welcome!
greet-reply = Welcome!
greet-reply-intent = Greet the customer

fetch = { -item(form: "cap") }, please!
fetch-reply = Yes, here's the { -item }.
fetch-reply-intent = Bring the order

order = { -count(form: "cap") } { -item(form: "counted") }, please!
order-reply = { -count(form: "cap") } { -item(form: "counted") }, here you are.
order-reply-intent = Serve the order
order-rephrase = { -item(form: "cap") }. { -count(form: "cap") }.


chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }
chat-a-reply-intent = Answer her

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }
chat-b-reply-intent = Answer her

thanks = Thank you!
thanks-reply = Thank you! Goodbye!
thanks-reply-intent = See the customer off
