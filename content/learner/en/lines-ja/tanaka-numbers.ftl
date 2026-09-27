one-two = One, two.
one-two-reply = One, two.
one-two-alt1 = Yes, see you.
one-two-alt2 = No, I don't.

three-four = One, two, three, four.
three-four-reply = One, two, three, four.
three-four-alt1 = One, two.
three-four-alt2 = Nice to meet you.

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-alt1 = One, two, three, four.
five-alt2 = Yes, see you.

next-a = { $number ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-a-reply = { -number(form: "cap") }!

next-b = { $number ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-b-reply = { -number(form: "cap") }!
