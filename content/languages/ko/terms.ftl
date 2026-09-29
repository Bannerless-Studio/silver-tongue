# Concepts that scene skeletons refer to. A line picks a form with $form.
# Numbers are the native Korean ones: base is the number said on its own (하나, 둘),
# count the form before a counter (한 개, 두 개). Prices use the Sino-Korean numbers (오, 천, 만).
# Four before a counter is 네, the same spelling as 네 "yes", so no slot counts four of something.

-tteokbokki = 떡볶이
-gimbap = 김밥
-eomuk = 어묵
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
    [count] 넷
   *[base] 넷
}
-five = { $form ->
    [count] 다섯
   *[base] 다섯
}
