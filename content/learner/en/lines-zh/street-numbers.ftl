one-two = One, two.
one-two-reply = One, two.
one-two-alt1 = Goodbye!
one-two-alt2 = I'm hungry.

three-four = One, two, three, four.
three-four-reply = One, two, three, four.
three-four-alt1 = One, two.
three-four-alt2 = How are you?

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-alt1 = One, two, three, four.
five-alt2 = Very well!

next-a = { $count ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-a-reply = { -count(form: "cap") }!

next-b = { $count ->
    [2] One…
    [3] One, two…
    [4] One, two, three…
   *[5] One, two, three, four…
}
next-b-reply = { -count(form: "cap") }!
