# Concepts that scene skeletons refer to. A line picks a word form with $form.

-tea = { $form ->
    [measure] 杯
   *[base] 茶
}
-water = { $form ->
    [measure] 杯
   *[base] 水
}
# 二 is for counting. Before a measure word two is 两 (两杯), which is HSK 2, so keep `two` out of
# groups used with measure words.
-two = 二
-three = 三
-four = 四
-five = 五

# Courtesies: what someone says (base) and the usual answer (reply).
-hello = { $form ->
    [reply] 你好
   *[base] 你好
}
-thanks = { $form ->
    [reply] 不客气
   *[base] 谢谢
}
-sorry = { $form ->
    [reply] 没关系
   *[base] 对不起
}
-bye = { $form ->
    [reply] 再见
   *[base] 再见
}
-six = 六
-seven = 七
-eight = 八
-nine = 九
-ten = 十
-table = 桌子
-chair = 椅子
-big = 大
-small = 小
-hospital = 医院
-school = 学校
-station = 火车站
-rice = 米饭
-vegetables = 菜
-noodles = 面条
-apple = 苹果
-cup = 杯子
-book = 书
-board = 上
-alight = 下

# Chinese small talk (zh-china): what an NPC says between jobs (base) and the answer (reply).
# chat_noodle: the cook, between orders (words of Old Wang's talks and the noodle shop's first talk).
-zn-hungry = { $form ->
    [reply] 我很饿！
   *[base] 你饿吗？
}
-zn-noodles = { $form ->
    [reply] 喜欢！我很喜欢面条。
   *[base] 你喜欢面条吗？
}
-zn-wang = { $form ->
    [reply] 是，老王是我朋友。
   *[base] 老王是你朋友吗？
}
-zn-eat = { $form ->
    [reply] 吃！谢谢！
   *[base] 你吃面条吗？
}
-zn-work = { $form ->
    [reply] 喜欢！我喜欢工作。
   *[base] 你喜欢工作吗？
}
-zn-cups = { $form ->
    [reply] 有五个。
   *[base] 杯子有几个？
}
-zn-how = { $form ->
    [reply] 很好，谢谢！
   *[base] 你好吗？
}
-zn-shop = { $form ->
    [reply] 很好！我喜欢饭馆。
   *[base] 饭馆好吗？
}
-zn-there = { $form ->
    [reply] 有！那里有饭馆。
   *[base] 那里有饭馆吗？
}
-zn-name = { $form ->
    [reply] 你叫小张！
   *[base] 我叫什么名字？
}
# chat_ware: Big Liu, between loads (words of Old Wang's talks and the warehouse).
-zw-hungry = { $form ->
    [reply] 饿！我想吃面条。
   *[base] 你饿吗？
}
-zw-work = { $form ->
    [reply] 想！我喜欢工作。
   *[base] 你想工作吗？
}
-zw-noodles = { $form ->
    [reply] 喜欢！我很喜欢吃面条。
   *[base] 你喜欢吃面条吗？
}
-zw-wang = { $form ->
    [reply] 是，老王是我朋友。
   *[base] 老王是你朋友吗？
}
-zw-there = { $form ->
    [reply] 有，那里有饭馆。
   *[base] 那里有饭馆吗？
}
-zw-how = { $form ->
    [reply] 很好，谢谢！
   *[base] 你好吗？
}
-zw-tables = { $form ->
    [reply] 好！六个桌子。
   *[base] 六个桌子，好吗？
}
-zw-big = { $form ->
    [reply] 很大！
   *[base] 那个桌子很大吗？
}
-zw-small = { $form ->
    [reply] 很小！
   *[base] 那个椅子很小吗？
}
-zw-name = { $form ->
    [reply] 你叫大刘！
   *[base] 我叫什么名字？
}
# chat_kitchen: the cook in the kitchen (words up to Miss Gao's first parcel).
-zk-hospital = { $form ->
    [reply] 医院在那里。
   *[base] 医院在哪里？
}
-zk-school = { $form ->
    [reply] 学校在医院前面。
   *[base] 学校在哪里？
}
-zk-station = { $form ->
    [reply] 在医院后面。
   *[base] 火车站在哪里？
}
-zk-live = { $form ->
    [reply] 我住李先生那里。
   *[base] 你住哪里？
}
-zk-now = { $form ->
    [reply] 我现在去学校。
   *[base] 你现在去哪里？
}
-zk-thing = { $form ->
    [reply] 这是杯子。
   *[base] 这个是什么？
}
-zk-gao = { $form ->
    [reply] 是，高小姐是我朋友。
   *[base] 高小姐是你朋友吗？
}
-zk-work = { $form ->
    [reply] 我在饭馆工作。
   *[base] 你在哪里工作？
}
-zk-hungry = { $form ->
    [reply] 饿了！我想吃面条。
   *[base] 你饿了吗？
}
-zk-big = { $form ->
    [reply] 很大！
   *[base] 那个桌子大吗？
}
# chat_lin: Mrs Lin, in her own voice, on the stairs (words up to the rent and the talks on the stairs).
-zs-son = { $form ->
    [reply] 他八岁。
   *[base] 我儿子几岁？
}
-zs-daughter = { $form ->
    [reply] 她十岁。
   *[base] 我女儿几岁？
}
-zs-dog = { $form ->
    [reply] 狗三岁。
   *[base] 我们的狗几岁？
}
-zs-cat = { $form ->
    [reply] 看见了！猫在睡觉。
   *[base] 你看见我女儿的猫了吗？
}
-zs-dad = { $form ->
    [reply] 他是医生。
   *[base] 我爸爸做什么工作？
}
-zs-mum = { $form ->
    [reply] 有，她有商店。
   *[base] 我妈妈有商店吗？
}
-zs-people = { $form ->
    [reply] 六个人。
   *[base] 我家里有几个人？
}
-zs-clothes = { $form ->
    [reply] 很漂亮！
   *[base] 我女儿的衣服漂亮吗？
}
-zs-love = { $form ->
    [reply] 爱！我爱狗。
   *[base] 你爱狗吗？
}
-zs-fruit = { $form ->
    [reply] 吃！我爱水果。
   *[base] 你吃苹果吗？
}
-zs-tv = { $form ->
    [reply] 看！我爱看电视。
   *[base] 你看电视吗？
}
-zs-rent = { $form ->
    [reply] 五十块。
   *[base] 李先生那里，一个星期多少钱？
}
-zs-years = { $form ->
    [reply] 十年了！
   *[base] 我住这里几年了？
}
-zs-li = { $form ->
    [reply] 认识！他很好。
   *[base] 你认识李先生吗？
}
-zs-home = { $form ->
    [reply] 是，我回家。
   *[base] 你回家吗？
}
-zs-happy = { $form ->
    [reply] 很高兴！
   *[base] 认识我们，你高兴吗？
}
-zs-and = { $form ->
    [reply] 我去饭馆工作。
   *[base] 我和我儿子去商店。你呢？
}
-zs-inside = { $form ->
    [reply] 是，我在饭馆里工作。
   *[base] 你在饭馆里工作吗？
}
-zs-sorry = { $form ->
    [reply] 没关系！狗很好。
   *[base] 对不起，我们的狗很大！
}
-zs-sleep = { $form ->
    [reply] 没有，她在看电视。
   *[base] 我女儿在睡觉吗？
}
-zs-flat = { $form ->
    [reply] 是，你家是二零八。
   *[base] 我家是二零八吗？
}
-zs-shop = { $form ->
    [reply] 有！有苹果。
   *[base] 我妈妈的商店里有水果吗？
}
-zs-people2 = { $form ->
    [reply] 很多人！
   *[base] 这里住多少人？
}
# chat_town: small talk anyone can make about home and the neighbours (words up to the talks on the stairs).
-zo-son = { $form ->
    [reply] 他八岁。
   *[base] 林太太的儿子几岁？
}
-zo-daughter = { $form ->
    [reply] 她十岁。
   *[base] 林太太的女儿几岁？
}
-zo-dog = { $form ->
    [reply] 有，她有狗。
   *[base] 林太太有狗吗？
}
-zo-cat = { $form ->
    [reply] 看见了！猫在睡觉。
   *[base] 你看见林太太女儿的猫了吗？
}
-zo-dad = { $form ->
    [reply] 我爸爸是医生。
   *[base] 你爸爸做什么工作？
}
-zo-mum = { $form ->
    [reply] 很好！她在家。
   *[base] 你妈妈好吗？
}
-zo-people = { $form ->
    [reply] 我家里有五个人。
   *[base] 你家里有几个人？
}
-zo-clothes = { $form ->
    [reply] 很漂亮！
   *[base] 我的衣服漂亮吗？
}
-zo-love = { $form ->
    [reply] 爱！我爱狗。
   *[base] 你爱狗吗？
}
-zo-cats = { $form ->
    [reply] 爱，猫很漂亮。
   *[base] 你爱猫吗？
}
-zo-fruit = { $form ->
    [reply] 吃！我爱水果。
   *[base] 你吃苹果吗？
}
-zo-tv = { $form ->
    [reply] 看！我爱看电视。
   *[base] 你看电视吗？
}
-zo-rent = { $form ->
    [reply] 五十块。
   *[base] 李先生那里，一个星期多少钱？
}
-zo-years = { $form ->
    [reply] 我住这里一个星期了。
   *[base] 你住这里几年了？
}
-zo-li = { $form ->
    [reply] 认识！他很好。
   *[base] 你认识李先生吗？
}
-zo-lin = { $form ->
    [reply] 认识！她是我朋友。
   *[base] 你认识林太太吗？
}
-zo-home = { $form ->
    [reply] 是，我现在回家。
   *[base] 你现在回家吗？
}
-zo-happy = { $form ->
    [reply] 很高兴！
   *[base] 你在这里高兴吗？
}
-zo-inside = { $form ->
    [reply] 是，我在饭馆里工作。
   *[base] 你在饭馆里工作吗？
}
-zo-sorry = { $form ->
    [reply] 没关系，是我的。
   *[base] 对不起，这是你的吗？
}
-zo-sleep = { $form ->
    [reply] 没有，我没睡觉。
   *[base] 你睡觉了吗？
}
-zo-shop = { $form ->
    [reply] 有！有苹果。
   *[base] 商店里有水果吗？
}
-zo-doctor = { $form ->
    [reply] 是，他是医生。
   *[base] 林太太的爸爸是医生吗？
}
-zo-and = { $form ->
    [reply] 是，我们去饭馆。
   *[base] 你和你朋友去饭馆吗？
}
-zo-money = { $form ->
    [reply] 有，我有工作。
   *[base] 你有钱吗？
}
-zo-flat = { $form ->
    [reply] 是，二零八。
   *[base] 林太太家是二零八吗？
}
# chat_school: small talk about the noon rush, the shop and the first class (words up to the first class).
-zq-study = { $form ->
    [reply] 是，我学习汉语。
   *[base] 你学习汉语吗？
}
-zq-write = { $form ->
    [reply] 会，我会写字。
   *[base] 你会写字吗？
}
-zq-noon = { $form ->
    [reply] 我吃米饭。
   *[base] 你中午吃什么？
}
-zq-restaurant = { $form ->
    [reply] 很好！人很多。
   *[base] 饭馆怎么样？
}
-zq-hot = { $form ->
    [reply] 很热！
   *[base] 饭馆热吗？
}
-zq-money = { $form ->
    [reply] 没有，我钱很少。
   *[base] 你有很多钱吗？
}
-zq-saturday = { $form ->
    [reply] 我去学校。
   *[base] 你星期六下午去哪里？
}
-zq-teacher = { $form ->
    [reply] 很好！我喜欢老师。
   *[base] 你的老师好吗？
}
-zq-lady = { $form ->
    [reply] 是，她是我同学。
   *[base] 那个小姐是你同学吗？
}
-zq-sir = { $form ->
    [reply] 他想吃米饭。
   *[base] 那个先生想吃什么？
}
-zq-apple = { $form ->
    [reply] 一个苹果五块。
   *[base] 苹果多少钱？
}
-zq-buy = { $form ->
    [reply] 我买水果。
   *[base] 你买什么？
}
-zq-which = { $form ->
    [reply] 我想吃这个。
   *[base] 你想吃哪个菜？
}
-zq-these = { $form ->
    [reply] 太好了！
   *[base] 这些菜怎么样？
}
-zq-listen = { $form ->
    [reply] 在听！
   *[base] 你在听吗？
}
-zq-david = { $form ->
    [reply] 是，大卫是我同学。
   *[base] 大卫是你同学吗？
}
-zq-read = { $form ->
    [reply] 会，我会读。
   *[base] 你会读汉语吗？
}
-zq-come = { $form ->
    [reply] 能！我能来。
   *[base] 你能来学校吗？
}
-zq-open = { $form ->
    [reply] 开了！
   *[base] 饭馆开了吗？
}
-zq-sit = { $form ->
    [reply] 谢谢，我坐这里。
   *[base] 请坐这个椅子！
}
# chat_class: the teacher and others after class (every word up to the class and Old Ma's taxi).
-zc-read = { $form ->
    [reply] 会，我会读这本书。
   *[base] 这本书你会读吗？
}
-zc-write = { $form ->
    [reply] 会！我会写字。
   *[base] 你会写汉语吗？
}
-zc-bike = { $form ->
    [reply] 没有，我没有自行车。
   *[base] 你有自行车吗？
}
-zc-film = { $form ->
    [reply] 爱！我爱看电影。
   *[base] 你爱电影吗？
}
-zc-students = { $form ->
    [reply] 很多学生！
   *[base] 学校里有多少学生？
}
-zc-parents = { $form ->
    [reply] 是，都是老师。
   *[base] 大卫的爸爸妈妈是老师吗？
}
-zc-sit = { $form ->
    [reply] 我坐大卫后面。
   *[base] 你坐哪里？
}
-zc-listen = { $form ->
    [reply] 听！我听老师说话。
   *[base] 你听老师说话吗？
}
-zc-minutes = { $form ->
    [reply] 是，十分钟。
   *[base] 坐出租车去医院，十分钟吗？
}
-zc-how = { $form ->
    [reply] 我会写，不会读。
   *[base] 这个字怎么读？
}
-zc-saturday = { $form ->
    [reply] 来！我星期六下午来。
   *[base] 你星期六下午来吗？
}
-zc-china = { $form ->
    [reply] 爱！我爱中国。
   *[base] 你爱中国吗？
}
-zc-beijing = { $form ->
    [reply] 不，我不去北京。
   *[base] 你去北京吗？
}
-zc-pets = { $form ->
    [reply] 有，大卫有猫和狗。
   *[base] 大卫有猫吗？
}
-zc-clothes = { $form ->
    [reply] 很漂亮！
   *[base] 大卫的衣服漂亮吗？
}
-zc-all = { $form ->
    [reply] 是，我们都是学生。
   *[base] 我们都是学生吗？
}
-zc-date = { $form ->
    [reply] 会！九月一日。
   *[base] 九月一日，你会写吗？
}
-zc-talk = { $form ->
    [reply] 大卫爱说话！
   *[base] 在学校，哪个学生爱说话？
}
-zc-taxi = { $form ->
    [reply] 不，我钱太少了！
   *[base] 你坐出租车吗？
}
-zc-month = { $form ->
    [reply] 现在是九月。
   *[base] 现在是几月？
}
-zc-book = { $form ->
    [reply] 我有三本书。
   *[base] 你有几本书？
}
-zc-gentleman = { $form ->
    [reply] 不是，他是医生。
   *[base] 那个先生是老师吗？
}
-zc-plane = { $form ->
    [reply] 想！我想去北京。
   *[base] 你想坐飞机吗？
}
-zc-sorry = { $form ->
    [reply] 是，我是他同学。
   *[base] 对不起，你是大卫的同学吗？
}
# chat_tea: Old Chen, between pots (every word up to his first talk).
-zt-tea = { $form ->
    [reply] 喝！我喜欢茶。
   *[base] 你喝茶吗？
}
-zt-water = { $form ->
    [reply] 想！谢谢！
   *[base] 你想喝水吗？
}
-zt-china = { $form ->
    [reply] 很喜欢！
   *[base] 你喜欢中国吗？
}
-zt-job = { $form ->
    [reply] 我在饭馆工作。
   *[base] 你做什么工作？
}
-zt-meet = { $form ->
    [reply] 我很高兴！
   *[base] 认识你很高兴！
}
-zt-saturday = { $form ->
    [reply] 来！星期六我来工作。
   *[base] 你星期六来吗？
}
-zt-sit = { $form ->
    [reply] 谢谢，老陈！
   *[base] 请坐！
}
-zt-station = { $form ->
    [reply] 在医院后面。
   *[base] 火车站在哪里？
}
-zt-gao = { $form ->
    [reply] 认识！高小姐是我朋友。
   *[base] 你认识高小姐吗？
}
-zt-study = { $form ->
    [reply] 是，我在学校学习。
   *[base] 你学习汉语吗？
}
-zt-lady = { $form ->
    [reply] 她想喝水。
   *[base] 那个小姐想喝什么？
}
-zt-film = { $form ->
    [reply] 看！我爱电影。
   *[base] 你看电影吗？
}
-zt-family = { $form ->
    [reply] 我家里有四个人。
   *[base] 你家里有几个人？
}
# chat_taxi: Old Ma at the taxi rank (every word up to his first talk).
-zx-beijing = { $form ->
    [reply] 不，我不去北京。
   *[base] 你去北京吗？
}
-zx-plane = { $form ->
    [reply] 不，我坐出租车。
   *[base] 你坐飞机吗？
}
-zx-price = { $form ->
    [reply] 十块钱。
   *[base] 去医院多少钱？
}
-zx-home = { $form ->
    [reply] 是，我回家。
   *[base] 你回家吗？
}
-zx-lady = { $form ->
    [reply] 去医院。
   *[base] 那个小姐去哪里？
}
-zx-sir = { $form ->
    [reply] 去学校。
   *[base] 那个先生去哪里？
}
-zx-taxi = { $form ->
    [reply] 在火车站前面。
   *[base] 出租车在哪里？
}
-zx-things = { $form ->
    [reply] 很多！太多了！
   *[base] 东西很多吗？
}
-zx-much = { $form ->
    [reply] 太多了！
   *[base] 坐出租车去北京，多少钱？
}
-zx-student = { $form ->
    [reply] 是，我学习汉语。
   *[base] 你是学生吗？
}
-zx-son = { $form ->
    [reply] 我二十八岁。
   *[base] 我儿子八岁。你呢？
}
-zx-hot = { $form ->
    [reply] 是，很热！
   *[base] 出租车里很热！
}
# End of Chinese small talk.
