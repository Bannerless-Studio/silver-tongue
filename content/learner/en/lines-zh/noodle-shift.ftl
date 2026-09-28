drink = { -item(form: "cap") }.
drink-reply = OK, { -item }.
drink-reply-intent = Repeat what they want

order = { -count(form: "cap") } cups of { -item }.
order-reply = OK, { -count } cups of { -item }.
order-reply-intent = Repeat the order
order-rephrase = { -item(form: "cap") }. { -count(form: "cap") } cups.
