one-two = One, two.
one-two-reply = One, two.
one-two-reply-intent = Count on
one-two-alt1 = Yes?
one-two-alt1-intent = Look puzzled
one-two-alt2 = No, I don't know.
one-two-alt2-intent = Say you don't know

three-four = One, two, three, four.
three-four-reply = One, two, three, four.
three-four-reply-intent = Count on
three-four-alt1 = One, two.
three-four-alt1-intent = Count on
three-four-alt2 = Thank you.
three-four-alt2-intent = Thank him

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-reply-intent = Count to five
five-alt1 = One, two, three, four.
five-alt1-intent = Count on
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
