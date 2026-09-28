# Concepts that scene skeletons refer to. A line picks a form with $form.
# Numbers: base is the number itself (prices), count the つ form for counting things.

-tea = お茶
-water = 水
-rice_ball = おにぎり
-bread = パン
-one = { $form ->
    [count] 一つ
   *[base] 一
}
-two = { $form ->
    [count] 二つ
   *[base] 二
}
-three = { $form ->
    [count] 三つ
   *[base] 三
}
-four = { $form ->
    [count] 四つ
   *[base] 四
}
-five = { $form ->
    [count] 五つ
   *[base] 五
}
