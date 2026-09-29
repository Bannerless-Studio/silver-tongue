# Grandpa Park counts on his fingers with the native numbers, then stops for you to say the next one.
# Wrong replies use only words met by then.

one-two = 하나, 둘.
one-two-reply = 하나, 둘.
one-two-alt1 = 네?
one-two-alt2 = 아니요, 몰라요.

three-four = 하나, 둘, 셋, 넷.
three-four-reply = 하나, 둘, 셋, 넷.
three-four-alt1 = 하나, 둘.
three-four-alt2 = 감사합니다.

five = 하나, 둘, 셋, 넷, 다섯!
five-reply = 하나, 둘, 셋, 넷, 다섯!
five-alt1 = 하나, 둘, 셋, 넷.
five-alt2 = 안녕하세요.

next-a = { $number ->
    [2] 하나……
    [3] 하나, 둘……
    [4] 하나, 둘, 셋……
   *[5] 하나, 둘, 셋, 넷……
}
next-a-reply = { -number }!

next-b = { $number ->
    [2] 하나……
    [3] 하나, 둘……
    [4] 하나, 둘, 셋……
   *[5] 하나, 둘, 셋, 넷……
}
next-b-reply = { -number }!
