# A customer orders at the counter; Ji-woo calls it out and you bring it.
fetch = { -item } 주세요!
fetch-reply = 네, { -item } 여기 있어요.

order = { -item } { -count(form: "count") } { -item(form: "counter") } 주세요!
order-reply = { -item } { -count(form: "count") } { -item(form: "counter") }, 여기 있어요.
order-rephrase = { -item }. { -count(form: "count") } { -item(form: "counter") }.
