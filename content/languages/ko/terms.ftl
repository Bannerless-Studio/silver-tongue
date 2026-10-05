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

# Small talk at the stall between orders (stage 1): Ji-woo brings back the first days' words
# and the stage's grammar (안, -고 싶어요, 하고, -(으)ㄹ까요?, -(으)ㅂ시다, -죠, -네요, 에서, 의, 쯤, 아니에요).
-cs-grandpa = { $form ->
    [reply] 네, 박 할아버지예요. 친구예요.
   *[base] 저기 할아버지 누구예요? 이름 알아요?
}
-cs-paper = { $form ->
    [reply] 아니요, 할아버지의 신문이에요.
   *[base] 저거 뭐예요? 할아버지 책이에요?
}
-cs-korean = { $form ->
    [reply] 아니요, 몰라요. 천천히 말해 주세요.
   *[base] 한국어 알아요?
}
-cs-fast = { $form ->
    [reply] 네? 다시 말해 주세요.
   *[base] 김밥 둘, 어묵 셋, 떡볶이 넷!
}
-cs-again = { $form ->
    [reply] 천천히 말해 주세요.
   *[base] 어묵 다섯, 김밥 넷!
}
-cs-sorry = { $form ->
    [reply] 괜찮아요. 미안해요.
   *[base] 왜요? 괜찮아요? 앉으세요.
}
-cs-sit = { $form ->
    [reply] 감사합니다. 같이 먹어요.
   *[base] 여기 앉으세요. 같이 먹을까요?
}
-cs-want = { $form ->
    [reply] 떡볶이 먹고 싶어요.
   *[base] 뭐 먹을까요?
}
-cs-fishcake = { $form ->
    [reply] 아니요, 안 먹어요. 미안해요.
   *[base] 떡볶이 드세요? 맛있어요.
}
-cs-tasty = { $form ->
    [reply] 네, 맛있네요! 여기에서 먹고 싶어요.
   *[base] 떡볶이 맛있죠?
}
-cs-money = { $form ->
    [reply] 돈은 삼천 원쯤 있어요.
   *[base] 돈 있어요? 얼마 있어요?
}
-cs-shop = { $form ->
    [reply] 아니요, 우유도 빵도 있어요.
   *[base] 저기 가게에 우유 없어요?
}
-cs-notfish = { $form ->
    [reply] 아니요, 김밥이 아니에요. 떡볶이예요.
   *[base] 저거 김밥이에요?
}

# Small talk at the shop (stage 1): the clerk, still sorry about the change.
-ch-grandpa = { $form ->
    [reply] 네, 할아버지 친구예요.
   *[base] 박 할아버지 친구예요?
}
-ch-where = { $form ->
    [reply] 네, 분식집에 가요.
   *[base] 어디 가요? 분식집에 가요?
}
-ch-paper = { $form ->
    [reply] 네, 신문도 주세요.
   *[base] 신문도 있어요. 할아버지 신문이에요.
}
-ch-sorry = { $form ->
    [reply] 네, 괜찮아요.
   *[base] 미안해요. 괜찮아요?
}
-ch-why = { $form ->
    [reply] 아니요, 돈 있어요. 여기 있어요.
   *[base] 왜요? 돈 없어요?
}
-ch-again = { $form ->
    [reply] 네? 다시 말해 주세요.
   *[base] 우유 천 원, 빵 천 원!
}
-ch-book = { $form ->
    [reply] 네, 한국어 책이에요.
   *[base] 이거 한국어 책이에요? 좋아요!
}
-ch-hungry = { $form ->
    [reply] 아니요, 괜찮아요.
   *[base] 배고파요? 빵 있어요.
}

# Small talk at the copy shop (stage 2): it brings back the photo and rent words.
-cc-brother = { $form ->
    [reply] 네, 민준 씨예요. 지금 없어요.
   *[base] 지우 씨 동생 알아요?
}
-cc-rent = { $form ->
    [reply] 네, 일주일에 오만 원이에요.
   *[base] 방세 냈어요? 일주일에 얼마예요?
}
-cc-march = { $form ->
    [reply] 네, 삼월까지 냈어요.
   *[base] 민준 씨는 삼월까지 방세 냈어요?
}
-cc-since = { $form ->
    [reply] 네, 삼월부터 안 왔어요.
   *[base] 민준 씨는 대학교에 안 왔어요?
}
-cc-took = { $form ->
    [reply] 네, 민준 씨가 책을 가져갔어요.
   *[base] 민준 씨가 책을 가져갔어요?
}
-cc-debt = { $form ->
    [reply] 네, 십만 원이에요.
   *[base] 민준 씨가 돈을 빌렸어요? 얼마예요?
}
-cc-when = { $form ->
    [reply] 아니요, 내일 또 올게요.
   *[base] 언제 또 와요? 다음 주?
}
-cc-copy = { $form ->
    [reply] 아니요, 편지를 복사해요.
   *[base] 뭐 복사해요? 사진?
}
-cc-notstudent = { $form ->
    [reply] 아니요, 학생이 아니에요.
   *[base] 학생이에요? 대학교 학생?
}
-cc-shop = { $form ->
    [reply] 네, 좋아요! 내일 또 와요.
   *[base] 여기 복사집 좋아요?
}
-cc-room = { $form ->
    [reply] 민준 씨 방에 있어요.
   *[base] 지금 어디에 있어요?
}
-cc-photo = { $form ->
    [reply] 민준 씨 사진이에요.
   *[base] 이거 봐요. 누구 사진이에요?
}
-cc-letter = { $form ->
    [reply] 네, 민준 씨 편지예요.
   *[base] 누구 편지예요? 대학교에서 왔어요?
}
-cc-stall = { $form ->
    [reply] 네, 맛있어요! 같이 가요.
   *[base] 지우 씨 분식집 알아요? 떡볶이 맛있죠?
}
-cc-sujin = { $form ->
    [reply] 네, 대학교에 있어요.
   *[base] 수진 씨 알아요? 지금 어디 있어요?
}
-cc-hungry = { $form ->
    [reply] 아니요, 괜찮아요. 안 배고파요.
   *[base] 지금 배고파요? 김밥 먹을까요?
}

# Things to copy (stage 2).
-book = 책
-letter = 편지
-photo = 사진
