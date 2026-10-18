# Concepts that scene skeletons refer to. A line picks a form with $form.
# Numbers: base is the number itself (prices), count the つ form for counting things.

-tea = お茶
-water = 水
-rice_ball = おにぎり
-bread = パン
-umbrella = 傘
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

# Small talk at the ramen shop (ramen-shift): only words from the scenes before it.
-rt-nihongo = { $form ->
    [reply] はい、日本語、わかります！
   *[base] 日本語、わかりますか？
}
-rt-namae = { $form ->
    [reply] いいえ、名前はわかりません。
   *[base] わたしの名前、わかりますか？
}
-rt-ooya = { $form ->
    [reply] 大家さんの名前はわかりません。
   *[base] 大家さんの名前、わかりますか？
}
-rt-heya = { $form ->
    [reply] はい、大家さんの部屋です。
   *[base] 部屋、ありますか？
}
-rt-kagi = { $form ->
    [reply] はい、これです。部屋のかぎです。
   *[base] 部屋のかぎ、ありますか？
}
-rt-kore = { $form ->
    [reply] はい、わたしの部屋のかぎです。
   *[base] これ、かぎですか？
}
-rt-yachin = { $form ->
    [reply] はい、毎週五千円です。
   *[base] 家賃は毎週五千円ですね。
}
-rt-sen = { $form ->
    [reply] いいえ、五千円です。
   *[base] 家賃、千円ですか？
}
-rt-okane = { $form ->
    [reply] はい、お金、あります。
   *[base] お金、ありますか？家賃は毎週ですよ。
}
-rt-ramen = { $form ->
    [reply] はい、食べました！
   *[base] ラーメン屋のラーメン、食べましたか？
}
-rt-ashita = { $form ->
    [reply] はい、明日も働きます。
   *[base] 明日もここで働きますか？
}
-rt-sore = { $form ->
    [reply] いいえ、それはお茶です。
   *[base] それは水ですか？
}
-rt-sayonara = { $form ->
    [reply] さようなら、田中さん。また明日！
   *[base] 田中さん、さようなら！
}
-rt-yo = { $form ->
    [reply] はい、わかります。
   *[base] 水も、お茶もありますよ。
}
-rt-oyasumi = { $form ->
    [reply] おやすみなさい。また明日。
   *[base] じゃあ、明日。おやすみなさい。
}
-rt-yoroshiku = { $form ->
    [reply] はい、よろしくお願いします。
   *[base] 明日もよろしくお願いします。
}

# Small talk at the convenience store (konbini-shift): the words of the later scenes.
-kt-ame = { $form ->
    [reply] はい、雨が降っています。寒いです。
   *[base] 今日も雨ですね。寒いですね。
}
-kt-furu = { $form ->
    [reply] いいえ、雨は降っていません。
   *[base] 雨が降っていますか？
}
-kt-kasa = { $form ->
    [reply] はい、田中さんの傘があります。
   *[base] 傘がありますか？
}
-kt-kara = { $form ->
    [reply] 五時から十時までです。
   *[base] 仕事は何時からですか？
}
-kt-mizu = { $form ->
    [reply] いいえ、水じゃありません。お茶です。
   *[base] これ、水ですか？
}
-kt-made = { $form ->
    [reply] はい、十時までです。
   *[base] 仕事は十時までですか？
}
-kt-mainichi = { $form ->
    [reply] はい、毎日働きます。
   *[base] 毎日、仕事ですか？
}
-kt-oishii = { $form ->
    [reply] はい、安いですが、おいしいです。
   *[base] ラーメン屋のラーメン、おいしいですか？
}
-kt-takai = { $form ->
    [reply] いいえ、高くないです。安いです。
   *[base] おにぎりは高いですか？
}
-kt-yasui = { $form ->
    [reply] はい、高くないです。おいしいです。
   *[base] コンビニのおにぎりは安いですね。
}
-kt-nomu = { $form ->
    [reply] はい、お茶を飲みます。
   *[base] 寒いですね。お茶を飲みませんか？
}
-kt-doko = { $form ->
    [reply] ラーメン屋へ行きます。
   *[base] どこへ行きますか？
}
-kt-asu = { $form ->
    [reply] 明日も五時から来ます。
   *[base] 明日は何時から来ますか？
}
-kt-nanji = { $form ->
    [reply] 十時に帰ります。
   *[base] 今日は何時に帰りますか？
}
-kt-issho = { $form ->
    [reply] はい、いっしょに行きました。
   *[base] 田中さんといっしょに行きましたか？
}
-kt-kau = { $form ->
    [reply] パンとお茶を買います。
   *[base] 何を買いますか？
}
-kt-ja = { $form ->
    [reply] すみません。お茶じゃありませんね。
   *[base] それはお茶じゃありませんよ。
}
-kt-tabetai = { $form ->
    [reply] ラーメンが食べたいです。
   *[base] 何が食べたいですか？
}
-kt-konbini = { $form ->
    [reply] はい、毎日コンビニへ来ます。
   *[base] 毎日コンビニへ来ますか？
}
-kt-kimasu = { $form ->
    [reply] はい、明日も来ます。
   *[base] 明日も来ますか？
}
