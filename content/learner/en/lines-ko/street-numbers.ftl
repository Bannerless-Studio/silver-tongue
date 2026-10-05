cost = Bread, milk: how much?
cost-reply = A thousand won, a thousand won.
cost-reply-intent = Tell him the prices
cost-alt1 = I don't know.
cost-alt1-intent = Say you don't know
cost-alt2 = Yes, thank you.
cost-alt2-intent = Say yes and thank him

money = No money?
money-reply = I have a thousand won.
money-reply-intent = Say how much is left
money-alt1 = Yes, I know.
money-alt1-intent = Say you know
money-alt1-answer = Do you have money?
money-alt2 = No, I don't know.
money-alt2-intent = Say you don't know
money-alt2-answer = A thousand won?

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
count-alt1 = Three, two, one.
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

# My reading of what was just said.
cost-why = What did the bread and milk cost?
money-why = Is my money gone?
note-why = That note is worth a thousand won.
count-why = He wants me to count with him.
owed-why = He says I am owed three thousand won.
five-why = He is counting up to five.
next-a-why = He wants the next number.
next-b-why = He wants the next number.
