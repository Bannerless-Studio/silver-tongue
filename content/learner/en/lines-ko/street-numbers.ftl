one-two = One, two.
one-two-reply = One, two.
one-two-reply-intent = Count on
one-two-alt1 = Yes?
one-two-alt1-intent = Look puzzled
one-two-alt2 = No.
one-two-alt2-intent = Say no

three = One, two, three.
three-reply = One, two, three.
three-reply-intent = Count on
three-alt1 = One, two.
three-alt1-intent = Count on
three-alt2 = Thank you.
three-alt2-intent = Thank him

five = Three, four, five!
five-reply = One, two, three, four, five!
five-reply-intent = Count to five
five-alt1 = One, two, three.
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

got = Got it?
got-reply = Yes, I've got it.
got-reply-intent = Say you've got it
got-alt1 = No.
got-alt1-intent = Say no
got-alt2 = One, two.
got-alt2-intent = Count

korean = Do you know Korean?
korean-reply = No, I don't.
korean-reply-intent = Admit you don't
korean-alt1 = Yes, thank you.
korean-alt1-intent = Say yes and thank him
korean-alt2 = I'm Grandpa Park.
korean-alt2-intent = Give a name

bye = Goodbye.
bye-reply = Thank you, Grandpa. Goodbye.
bye-reply-intent = Thank him and take your leave
bye-alt1 = Goodbye (you go).
bye-alt1-intent = See him off
bye-alt2 = Do you know Korean?
bye-alt2-intent = Ask about Korean
