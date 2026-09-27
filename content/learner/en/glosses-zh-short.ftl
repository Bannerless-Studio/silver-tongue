# Hand-edited, unlike glosses-zh.ftl: 1-3 word display glosses the checker asks for when the
# heuristic in packages/view/src/help.ts (shortGloss/heuristicGloss) can't shorten a word's first
# sense well on its own - either because every sense is a parenthetical aside, or because the
# pack's first literal sense isn't the word's everyday one. Not every word needs an entry: most
# resolve fine through the heuristic alone. Where a value is informed by the vocab-engine pack's
# own curated display glosses (vendor/vocab-engine's live source, packs/zh/gloss_display.json,
# not vendored here), that's noted below.
#
# Key = the word id as used in glosses-zh.ftl. Add an entry whenever `npm run build:course`
# warns that a stage word has no curated short gloss and fell back to its heuristic's aside.

# vocab-engine gloss_display.json: "on, in (N上); last (上个月); ..." - but every line in this
# course uses 上 as "get in/board" (上出租车), never the "on" sense, so that's shown instead.
w0004 = to get in
w0009 = not
w0012 = (measure word)
w0018 = (done)
w0021 = some
w0023 = what
w0031 = sir
w0037 = how many
# vocab-engine gloss_display.json: "to be called; to call; to shout"
w0046 = to be called
# vocab-engine gloss_display.json: "classmate; fellow student"
w0048 = classmate
w0051 = (question)
w0053 = (question particle)
w0055 = which
# vocab-engine gloss_display.json: "to go back, return (回家); measure word for times"
w0061 = to return
# vocab-engine gloss_display.json: "at, in (在+place); to be (located) at; ..."
w0062 = at
# vocab-engine gloss_display.json: "yuan (spoken); piece (measure word); lump"
w0064 = yuan
# vocab-engine gloss_display.json: "too; very (太…了)"
w0069 = too
w0081 = Miss
w0083 = years old
w0087 = very
# vocab-engine gloss_display.json: "hot; to heat up"
w0116 = hot
w0125 = (possessive)
# vocab-engine gloss_display.json: "please; to invite, to treat (我请你); to ask"
w0138 = please
# vocab-engine gloss_display.json: "in, inside (N里); lining"
w0145 = inside
w0146 = money

# The heuristic's first sense is technically correct but not the sense every line in this course
# actually uses; picked from how the word is actually used in content/languages/zh/lines.
w0029 = to do
# gloss is "to think (about); to think of; to devise", but every line uses the auxiliary-verb
# sense ("want to", e.g. 你想工作吗？), never the literal "to think".
w0090 = want to
# gloss is "to see; to look at; to read", but every line uses "to watch/look at" (看电视, 看电影,
# 不看电脑); the "to see" sense already belongs to 看见 (w0127), so showing it here for 看 would
# blur the two.
w0126 = to watch
# gloss is only "root; stem" - the pack never lists this word's measure-word sense at all, but
# every line in this course uses it as the classifier for books (这本书, 十本书).
w0103 = (measure word)
w0115 = o'clock
w0074 = character
w0100 = month
w0094 = day
