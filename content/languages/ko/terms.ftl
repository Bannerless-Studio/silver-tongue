# Concepts that scene skeletons refer to. A line picks a form with $form.
# Numbers are the native Korean ones: base is the number said on its own (하나, 둘),
# count the form before a counter (한 개, 두 개). Prices use the Sino-Korean numbers (오, 천, 만).
# Four before a counter is 네, the same spelling as 네 "yes", so no slot counts four of something.
# A food's counter form is the counter it takes: 떡볶이 한 그릇, 김밥 한 줄, 어묵 한 개.

-tteokbokki = { $form ->
    [counter] 그릇
   *[base] 떡볶이
}
-gimbap = { $form ->
    [counter] 줄
   *[base] 김밥
}
-eomuk = { $form ->
    [counter] 개
   *[base] 어묵
}
-milk = 우유
-bread = 빵
-one = { $form ->
    [count] 한
   *[base] 하나
}
-two = { $form ->
    [count] 두
   *[base] 둘
}
-three = { $form ->
    [count] 세
   *[base] 셋
}
-four = { $form ->
    [count] 네
   *[base] 넷
}
-five = { $form ->
    [count] 다섯
   *[base] 다섯
}

# Small talk between jobs: what is said (base) and the answer wanted (reply).
-chat-sit = { $form ->
    [reply] 감사합니다.
   *[base] 여기 앉으세요.
}
-chat-korean = { $form ->
    [reply] 아니요, 몰라요.
   *[base] 한국어 알아요?
}
-chat-hungry = { $form ->
    [reply] 네, 배고파요.
   *[base] 배고파요?
}
-chat-money = { $form ->
    [reply] 아니요, 없어요.
   *[base] 돈 있어요?
}
-chat-work = { $form ->
    [reply] 네, 일해요!
   *[base] 내일 일해요?
}
-chat-ok = { $form ->
    [reply] 네, 괜찮아요!
   *[base] 괜찮아요?
}
-chat-friend = { $form ->
    [reply] 아니요.
   *[base] 민준 씨 친구예요?
}
-chat-got = { $form ->
    [reply] 네, 알아요.
   *[base] 알아요?
}
-chat-come = { $form ->
    [reply] 네, 와요.
   *[base] 내일 와요?
}
-chat-milk = { $form ->
    [reply] 네, 알아요.
   *[base] 우유는 천 원이에요.
}
-chat-bread = { $form ->
    [reply] 빵은 천 원?
   *[base] 빵은 천 원이에요.
}
-chat-cash = { $form ->
    [reply] 네, 있어요.
   *[base] 돈 있어요?
}
-chat-three = { $form ->
    [reply] 아니요, 천 원.
   *[base] 삼천 원이에요?
}
-chat-name = { $form ->
    [reply] 박 할아버지예요.
   *[base] 할아버지 이름이 뭐예요?
}
-chat-who = { $form ->
    [reply] 할아버지예요.
   *[base] 저기, 누구예요?
}
-chat-there = { $form ->
    [reply] 네, 저기 있어요.
   *[base] 할아버지가 저기 있어요?
}
