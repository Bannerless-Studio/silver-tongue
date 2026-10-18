greet = Hello!
greet-reply = Hello! What's your name?
greet-reply-intent = Greet her and ask her name
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
    [3] Cups! One, two...
    [4] Cups! One, two, three...
   *[5] Cups! One, two, three, four...
}
count-reply = { -number } cups!
count-reply-intent = Say how many cups
count-alt1 = Fine!
count-alt1-intent = Say fine
count-alt2 = I'm hungry.
count-alt2-intent = Say you're hungry

like = Do you like noodles?
like-reply = I do! Can I come and work here?
like-reply-intent = Say yes, and ask for work
like-alt1 = Three cups!
like-alt1-intent = Say three cups
like-alt2 = Goodbye!
like-alt2-intent = Say goodbye

job = Good, come and work!
job-reply = Thank you!
job-reply-intent = Thank her
job-alt1 = Goodbye!
job-alt1-intent = Say goodbye
job-alt2 = My name is { $player }.
job-alt2-intent = Say your name
