# Old Wang counts on his fingers, then stops for you to say the next number.
# Wrong replies use only words met by then.

one-two = 一，二。
one-two-reply = 一，二。
one-two-alt1 = 再见！
one-two-alt2 = 我饿了。

three-four = 一，二，三，四。
three-four-reply = 一，二，三，四。
three-four-alt1 = 一，二。
three-four-alt2 = 你好吗？

five = 一，二，三，四，五！
five-reply = 一，二，三，四，五！
five-alt1 = 一，二，三，四。
five-alt2 = 很好！

next-a = { $count ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-a-reply = { -count }！

next-b = { $count ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-b-reply = { -count }！
