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

next-a = { $number ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-a-reply = { -number }！

next-b = { $number ->
    [2] 一……
    [3] 一，二……
    [4] 一，二，三……
   *[5] 一，二，三，四……
}
next-b-reply = { -number }！

praise = 很好！很好！
praise-reply = 谢谢，老王！
praise-alt1 = 一，二。
praise-alt2 = 再见！

welcome = 不客气！
welcome-reply = 对不起，我饿了！
welcome-alt1 = 很好！
welcome-alt2 = 一，二，三，四，五！

forgive = 没关系！那里有饭馆！
forgive-reply = 好！谢谢！再见！
forgive-alt1 = 你好吗？
forgive-alt2 = 一，二。
