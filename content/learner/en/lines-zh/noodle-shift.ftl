drink = { -item(form: "cap") }.
drink-reply = OK, { -item }.
drink-reply-intent = { -item(form: "cap") }

order = { -count(form: "cap") } cups of { -item }.
order-reply = OK, { -count } cups of { -item }.
order-reply-intent = { -count(form: "cap") } cups of { -item }
order-rephrase = { -item(form: "cap") }. { -count(form: "cap") } cups.
