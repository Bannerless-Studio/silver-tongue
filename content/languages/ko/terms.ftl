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

# Small talk at the copy shop (stage 2): it brings back the photo and rent words.
-cc-photo = { $form ->
    [reply] 네, 사진이에요.
   *[base] 이거 사진이에요?
}
-cc-brother = { $form ->
    [reply] 아니요, 동생 없어요.
   *[base] 동생 있어요?
}
-cc-rent = { $form ->
    [reply] 네, 냈어요.
   *[base] 방세 냈어요?
}
-cc-week = { $form ->
    [reply] 네, 일주일에 오만 원.
   *[base] 방세는 일주일에 오만 원이에요?
}
-cc-now = { $form ->
    [reply] 아니요, 지금 괜찮아요.
   *[base] 지금 배고파요?
}
-cc-letter = { $form ->
    [reply] 누구 편지예요?
   *[base] 이거 봐요. 편지예요.
}
-cc-student = { $form ->
    [reply] 네, 대학교 학생이에요.
   *[base] 민준 씨는 학생이에요?
}
-cc-school = { $form ->
    [reply] 아니요, 분식집에서 왔어요.
   *[base] 대학교에서 왔어요?
}
-cc-march = { $form ->
    [reply] 네, 삼월까지 일해요.
   *[base] 삼월까지 일해요?
}
-cc-sujin = { $form ->
    [reply] 대학교에 있어요.
   *[base] 수진 씨 어디 있어요?
}
-cc-sit = { $form ->
    [reply] 감사합니다.
   *[base] 여기 앉으세요.
}
-cc-book = { $form ->
    [reply] 네, 책도 복사해요.
   *[base] 책은 복사해요?
}
-cc-copy = { $form ->
    [reply] 아니요, 사진을 복사해요.
   *[base] 편지를 복사해요?
}
-cc-room = { $form ->
    [reply] 저는 민준 씨 방에 있어요.
   *[base] 방 있어요?
}
-cc-stall = { $form ->
    [reply] 네, 지우 씨 분식집이에요.
   *[base] 분식집 알아요?
}
-cc-since = { $form ->
    [reply] 네, 삼월부터 안 왔어요.
   *[base] 민준 씨는 삼월부터 안 왔어요?
}
-cc-took = { $form ->
    [reply] 네, 민준 씨가 가져갔어요.
   *[base] 민준 씨가 책을 가져갔어요?
}
-cc-debt = { $form ->
    [reply] 네, 십만 원이에요.
   *[base] 민준 씨가 돈을 빌렸어요?
}
-cc-when = { $form ->
    [reply] 다음 주에 또 올게요.
   *[base] 언제 또 와요?
}
-cc-notstudent = { $form ->
    [reply] 아니요, 학생이 아니에요.
   *[base] 학생이에요?
}

# Things to copy (stage 2).
-book = 책
-letter = 편지
-photo = 사진
