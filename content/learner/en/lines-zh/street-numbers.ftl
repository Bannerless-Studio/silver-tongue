one-two = One, two.
one-two-reply = One, two.
one-two-reply-intent = Count on
one-two-alt1 = Goodbye!
one-two-alt1-intent = Say goodbye
one-two-alt2 = I'm hungry.
one-two-alt2-intent = Say you're hungry

three-four = One, two, three, four.
three-four-reply = One, two, three, four.
three-four-reply-intent = Count on
three-four-alt1 = One, two.
three-four-alt1-intent = Count on
three-four-alt2 = How are you?
three-four-alt2-intent = Ask how they are

five = One, two, three, four, five!
five-reply = One, two, three, four, five!
five-reply-intent = Count to five
five-alt1 = One, two, three, four.
five-alt1-intent = Count on
five-alt2 = Very well!
five-alt2-intent = Say you're well

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

praise = Very good! Very good!
praise-reply = Thank you, Old Wang!
praise-reply-intent = Thank Old Wang
praise-alt1 = One, two.
praise-alt1-intent = Count to two
praise-alt2 = Goodbye!
praise-alt2-intent = Say goodbye

welcome = You're welcome!
welcome-reply = Sorry, I'm hungry!
welcome-reply-intent = Apologise: you're hungry
welcome-alt1 = Very well!
welcome-alt1-intent = Say you're well
welcome-alt2 = One, two, three, four, five!
welcome-alt2-intent = Count to five

forgive = No problem! There's the restaurant!
forgive-reply = OK! Thanks! Goodbye!
forgive-reply-intent = Thank him and say goodbye
forgive-alt1 = How are you?
forgive-alt1-intent = Ask how he is
forgive-alt2 = One, two.
forgive-alt2-intent = Count to two
