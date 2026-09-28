# Mr Tanaka counts things on his fingers with つ, then stops for you to say the next one.
# Wrong replies use only words met by then.

one-two = 一つ、二つ。
one-two-reply = 一つ、二つ。
one-two-alt1 = はい、また。
one-two-alt2 = いいえ、わかりません。

three-four = 一つ、二つ、三つ、四つ。
three-four-reply = 一つ、二つ、三つ、四つ。
three-four-alt1 = 一つ、二つ。
three-four-alt2 = よろしくお願いします。

five = 一つ、二つ、三つ、四つ、五つ！
five-reply = 一つ、二つ、三つ、四つ、五つ！
five-alt1 = 一つ、二つ、三つ、四つ。
five-alt2 = はい、また。

next-a = { $number ->
    [2] 一つ……
    [3] 一つ、二つ……
    [4] 一つ、二つ、三つ……
   *[5] 一つ、二つ、三つ、四つ……
}
next-a-reply = { -number(form: "count") }！

next-b = { $number ->
    [2] 一つ……
    [3] 一つ、二つ……
    [4] 一つ、二つ、三つ……
   *[5] 一つ、二つ、三つ、四つ……
}
next-b-reply = { -number(form: "count") }！
