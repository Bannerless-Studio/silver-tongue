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
