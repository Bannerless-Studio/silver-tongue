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

ok = All right?
ok-reply = Yes, I'm fine!
ok-reply-intent = Say you're fine

thanks = Thank you!
thanks-reply = Thank you! Goodbye!
thanks-reply-intent = See the customer off
