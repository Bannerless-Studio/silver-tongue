# Grandpa Park counts on his fingers with the native numbers, then stops for you to say the next one.
# Wrong replies use only words met by then.

one-two = 하나, 둘.
one-two-reply = 하나, 둘.
one-two-alt1 = 네?
one-two-alt2 = 아니요.

three = 하나, 둘, 셋.
three-reply = 하나, 둘, 셋.
three-alt1 = 하나, 둘.
three-alt2 = 감사합니다.

five = 셋, 넷, 다섯!
five-reply = 하나, 둘, 셋, 넷, 다섯!
five-alt1 = 하나, 둘, 셋.
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

got = 알아요?
got-reply = 네, 알아요.
got-alt1 = 아니요.
got-alt2 = 하나, 둘.

korean = 한국어 알아요?
korean-reply = 아니요, 몰라요.
korean-alt1 = 네, 감사합니다.
korean-alt2 = 박 할아버지예요.

bye = 안녕히 가세요.
bye-reply = 감사합니다, 할아버지. 안녕히 계세요.
bye-alt1 = 안녕히 가세요.
bye-alt2 = 한국어 알아요?
