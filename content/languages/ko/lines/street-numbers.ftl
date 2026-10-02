# Grandpa Park saw the shop. He holds up the one note you got back, counts three on his fingers
# (the native numbers), says what it should have been (삼천 원), then counts on to five with you.
# Each <id>-alt<n> is a written wrong reply, using only words met by then.

cost = 빵, 우유, 얼마예요?
cost-reply = 몰라요.
cost-alt1 = 네, 감사합니다.
cost-alt2 = 가게 어디예요?

note = 이거 천 원. 하나.
note-reply = 하나?
note-alt1 = 우유도 주세요.
note-alt2 = 좋아요!

count = 하나, 둘, 셋.
count-reply = 하나, 둘, 셋.
count-alt1 = 하나?
count-alt2 = 천천히 말해 주세요.

owed = 셋! 삼천 원이에요.
owed-reply = 삼천 원?
owed-alt1 = 천 원이에요.
owed-alt2 = 하나, 둘.

five = 하나, 둘, 셋, 넷, 다섯!
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
