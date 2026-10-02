cost = Bread, milk: how much?
cost-reply = I don't know.
cost-reply-intent = Answer honestly
cost-alt1 = Yes, thank you.
cost-alt1-intent = Say yes and thank him
cost-alt2 = Where's the shop?
cost-alt2-intent = Ask where the shop is

note = This is a thousand won. One.
note-reply = One?
note-reply-intent = Repeat the number
note-alt1 = Milk too, please.
note-alt1-intent = Ask for milk
note-alt2 = Good!
note-alt2-intent = Say it's fine

count = One, two, three.
count-reply = One, two, three.
count-reply-intent = Count along
count-alt1 = One, two.
count-alt1-intent = Count along
count-alt2 = Yes, thank you.
count-alt2-intent = Say yes and thank him

owed = Three! Three thousand won.
owed-reply = Three thousand won?
owed-reply-intent = Check the amount
owed-alt1 = It's a thousand won.
owed-alt1-intent = Give an amount
owed-alt2 = One, two.
owed-alt2-intent = Count

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-reply-intent = Count to five
five-alt1 = One, two, three, four.
five-alt1-intent = Count to five
five-alt2 = Hello.
five-alt2-intent = Say hello

next-a = { $number ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-a-reply = { -number(form: "cap") }!
next-a-reply-intent = Say the next number

next-b = { $number ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-b-reply = { -number(form: "cap") }!
next-b-reply-intent = Say the next number
