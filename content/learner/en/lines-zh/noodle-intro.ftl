greet = Hello!
greet-reply = Hello! What's your name?
greet-reply-intent = Greet him and ask his name
greet-alt1 = Goodbye!
greet-alt1-intent = Say goodbye
greet-alt2 = How are you?
greet-alt2-intent = Ask how they are

names = My name is Xiao Zhang. And you?
names-reply = My name is { $player }. Old Wang is my friend.
names-reply-intent = Give your name and mention Old Wang
names-alt1 = My name is Xiao Zhang.
names-alt1-intent = Say you're Xiao Zhang
names-alt2 = Hello!
names-alt2-intent = Say hello

count = { $number ->
    [2] How many cups? One...
    [3] How many cups? One, two...
    [4] How many cups? One, two, three...
   *[5] How many cups? One, two, three, four...
}
count-reply = { -number }!
count-reply-intent = Say the next number
count-alt1 = Fine!
count-alt1-intent = Say fine
count-alt2 = I'm hungry.
count-alt2-intent = Say you're hungry

like = Do you like noodles?
like-reply = I do! I like noodles.
like-reply-intent = Say you like them
like-alt1 = Three cups!
like-alt1-intent = Say three cups
like-alt2 = Goodbye!
like-alt2-intent = Say goodbye

job = Good, come and work!
job-reply = Thank you!
job-reply-intent = Thank them
job-alt1 = Goodbye!
job-alt1-intent = Say goodbye
job-alt2 = My name is { $player }.
job-alt2-intent = Say your name
