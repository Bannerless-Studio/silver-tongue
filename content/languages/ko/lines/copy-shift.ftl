# A student brings something to copy; you make the copies, chat with the copy-shop man between jobs,
# and see the student off. Copies are counted with 장 (sheets), after the native numbers.

greet = 학생 왔어요!
greet-reply = 어서 오세요!

order = { -item } { -count(form: "count") } 장 복사해 주세요.
order-reply = { -item } { -count(form: "count") } 장, 여기 있어요.
order-rephrase = { -item }. { -count(form: "count") } 장.

chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }

chat-c = { -topic }
chat-c-reply = { -topic(form: "reply") }

thanks = 감사합니다!
thanks-reply = 감사합니다! 또 오세요!
