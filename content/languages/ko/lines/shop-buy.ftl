# Buy something to eat, then count the change: a thousand-won item paid with a five-thousand-won note.
# The clerk, still sorry about the change he kept, makes small talk (chat_shop).
buy = { -item }? 천 원이에요.
buy-reply = 네, { -item } 주세요.

change = 여기, 사천 원.
change-reply = 하나, 둘, 셋, 넷. 감사합니다.
change-alt1 = 하나, 둘, 셋. 감사합니다.
change-alt2 = 삼천 원?

chat-a = { -topic }
chat-a-reply = { -topic(form: "reply") }

chat-b = { -topic }
chat-b-reply = { -topic(form: "reply") }

chat-c = { -topic }
chat-c-reply = { -topic(form: "reply") }

bye = 안녕히 가세요.
bye-reply = 안녕히 계세요.
bye-alt1 = 안녕히 가세요.
bye-alt2 = 미안해요.
