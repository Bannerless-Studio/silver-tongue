# Changelog

Every release of Silver Tongue, newest first.

## 0.18.0 (2026-09-29)

- A third way to play in the browser, the quiet terminal, at /quiet/. It shows only what changed: rent appears when you are about to fall short, a new word explains itself once, and a word you keep missing is underlined. Tap `?` on any line to see its reading and meaning, N for your notebook (it opens on the words that need work and why), S for your money, rent and standing.
- Once you know every word of a reply, you type it: in Chinese or pinyin (Japanese or rōmaji). Tones, spaces and punctuation don't matter, and you can mix characters and letters. Two wrong tries and the choices come back.
- [tab] gives a hint, three per reply: first what the reply does and how long it is, then its key words, then the reply itself. The second and third cost some of the pay.
- A job shows its progress while you work: the steps done and to come, the time left in the day, and a few of its words you're still learning. A delivery shows its steps too: get the parcel, take it there, hand it over.
- A quick review appears in the menu when words start fading: fill in the blank in a line you've heard, from four words. It shows the word's reading and meaning, and how well you remember it.
- The notebook has tabs: Words, Phrases (the lines of each conversation, with readings and meanings), People (where they are, how much they trust you, what you talked about), Places and Notes. Words are labelled new, familiar, fading or safe, and ★ Recent comes first.
- In the browser, the key bar has a [tab] key.

## 0.17.2 (2026-09-28)

- A word you look up opens right under the line it's in, with a thin line to the word, and your choices stay on screen. The card gives the word's reading, its full meaning, and an example from another line of the game, with its reading and meaning. [p] says the word again.
- New words are no longer explained under each line: they stand out in colour, and [w] explains them when you want.
- Each reply says what it does ("Ask the price", "Greet Old Wang") instead of translating it, so you work out the Chinese or Japanese yourself.
- A new last choice, "... (Look confused)": the other person says it again, more slowly or in other words, and mimes it. You earn nothing for that exchange, but you lose nothing either.
- The top bar shows the time of day and where you are: "Day 1 · 08:05 · Suzhou, 1980" (Tokyo, 1995 in Japanese).

## 0.17.1 (2026-09-28)

- The text game shows less and says more. The top bar names what to do next ("Next: Meet Old Wang") in place of your rank and the time of day.
- Sleep appears once the day is over: when you've used up your time, or there's nothing left to do.
- Once you answer right, your wrong tries and the hints they brought disappear, so a conversation reads as questions and answers. Each hint shows once per question, and moving to a new place starts a clean screen.
- The noodle shop opens after Old Wang teaches you to count. A place is announced once, not again with the scene that takes you there.
- When someone is the only person at a place, the menu doesn't repeat their name after each choice.
- The notebook groups words by topic (Courtesies, Food and drink, Numbers…), and by place for the rest. Recent is hidden when it would list every word.
- A word you look up shows the line you first heard it in.
- In the browser, arrows in the key bar no longer overlap the text next to them.

## 0.17.0 (2026-09-28)

- A second course: Japanese, set in Tokyo in the mid-90s. Your bag was stolen with your passport in it, and a new one takes weeks. Nine scenes on a shopping street: Mr Tanaka on his bench, your room and the landlady, a ramen shop that pays for shifts, and a convenience store. 54 beginner (JLPT N5) words, with kana and romaji readings, audio for every line, and four notes from Mr Tanaka. Choose it in settings, or run with `--learn ja`.
- Word help and sentence help read a verb the way it is written in the line: 働きました shows hatarakimashita, not hatarakimasu. A reply's form of a word can be looked up too.
- The Japanese has not been checked by a native speaker yet.
- The Japanese course has no visual novel art yet, so the visual novel offers only Chinese; play Japanese in the text game.

## 0.16.2 (2026-09-28)

- You discover the town one place at a time. At first Main Street is all you know; Old Wang points you to the noodle shop, and each new place opens as the story reaches it. The game tells you when it does ("New places: …").
- You sleep only where there's a bed: on Main Street until the landlord gives you a room, then in your room. Elsewhere there's no Sleep choice.

## 0.16.1 (2026-09-28)

- The text game has a new look. The screen is split into boxes: where you are and what day it is at the top, then your money, how many days until rent and how well you speak, then the conversation, then your choices.
- Under a line someone says, you now see how it's pronounced (pinyin for Chinese), until you know every word in it.
- A word you look up opens in its own box above your choices, instead of in the conversation.
- The notebook has two columns: your words on the right, grouped by where you heard them, with the ones from the last day under Recent. A bar shows how well you remember each word. Press 2 for the notes you've been told.
- On a phone, the key bar has ← and → for moving around the notebook.
- Silver Tongue is made by Bannerless Studio, and now says so.

## 0.16.0 (2026-09-27)

- The game's rules engine (`@silver-tongue/core`) is now closed source. It lives in the private repository `Bannerless-Studio/silver-tongue-core`, and this repository uses a compiled copy of it. The front ends, the course content and the tools stay open here. Your saved games are unchanged and carry on in every version.
- Silver Tongue is no longer published to npm. `npx silver-tongue` still runs 0.15.0, the last version released there, but it won't get updates. To play the latest version, use the web pages or run it from a clone (below).
- Versions up to 0.15.0 were released under the MIT License and stay that way. From 0.16.0 the engine is proprietary. Its license lets games and tools published by Bannerless Studio use it; anyone else needs written permission.

### Getting access to core

To build or run this repository you need read access to the engine package.

1. **Ask for access.** Open an issue in this repository saying who you are and what you are building. If you're approved, you'll get Read access to the package `@bannerless-studio/silver-tongue-core` on GitHub Packages.
2. **Make a token.** In GitHub, go to Settings → Developer settings → Personal access tokens and create a classic token with only the `read:packages` scope. If you use the GitHub CLI, run `gh auth refresh -h github.com -s read:packages` instead.
3. **Install with the token set:**
   ```sh
   export GITHUB_PACKAGES_TOKEN=<your token>   # or: export GITHUB_PACKAGES_TOKEN=$(gh auth token)
   npm install
   ```
   The repository's `.npmrc` sends `@bannerless-studio` packages to GitHub Packages and reads the token from that variable. Nothing else changes: code still imports `@silver-tongue/core` and `@silver-tongue/core/testing`.
4. **In GitHub Actions:** the repository has to be added under the package's *Manage Actions access* settings. Then give the job `permissions: packages: read` and set `GITHUB_PACKAGES_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on `npm ci`. A repository outside the Bannerless-Studio org can't use its own `GITHUB_TOKEN` for this: store a personal token with `read:packages` as a secret and use that.

If `npm install` fails with `401` or `403` on `npm.pkg.github.com`, the token is missing, lacks `read:packages`, or hasn't been granted access to the package yet.

## 0.15.0 (2026-09-27)

- The visual novel now plays itself. Each line stays as long as it takes to read it and to hear it said, and a tap still hurries it on. If you would rather choose every line, turn it off in settings.
- Speech starts slow, so there is time to copy what you hear. Settings has a speed choice — slow, normal or fast — and the text game at /text/ plays at the same speed.
- The place menu and your replies no longer look like the same button: your replies are big cards, and the place menu is a quiet list of where you can go.
- The intro now says where and when you are: China, 1980, with no phone, no translator and nobody who speaks your language.
- The first conversation with Old Wang is a real one: he introduces himself, asks how you are, then asks your name, instead of quizzing you on the same line twice.
- The cook now actually interviews you for the noodle shop job: she has you count her cups and asks if you like noodles before hiring you.
- Old Wang's friend at the noodle shop is introduced by name in conversation, not shouted out of nowhere.
- Wrong-answer hints now say who was talking and what they were doing, instead of a plain "they".
- "There", "here" and "where" are taught as whole words now, not split into two misleading pieces.

## 0.14.0 (2026-09-26)

- A new way to play in the browser: a visual novel. Each place is drawn, the people you talk to stand in front of you as silhouettes, and their lines appear one at a time. Tap any word to look it up.
- The game's web address now opens the visual novel. The text version is at /text/, and your games are the same in both, so you can switch at any point.
- Play it on a phone held sideways.

## 0.13.0 (2026-09-26)

- Ready for more languages: each course keeps its own games, and [o] opens settings to switch what you learn, what you read the game in, and sound.
- `--learn` and `--read` choose from the command line, and the game remembers your choice.
- Your games carry over from earlier versions.
- The browser version loads the course it needs, so it must be served from a web server.

## 0.12.2 (2026-09-26)

- A right tiles answer is shown as the whole reply, punctuation and all.
- The silence around each spoken clip is trimmed, so lines follow each other without long pauses.

## 0.12.1 (2026-09-26)

- Word help can say the whole sentence too ([s]), and [p] says it again.

## 0.12.0 (2026-09-26)

- Sound: people speak their lines and you hear your own reply, in the terminal (ffplay, mpv, mpg123 or afplay) and in the browser.
- Each character has their own voice; a line with your name pauses where your name goes.
- [r] hears a line again, [m] turns sound on or off, [p] says a word you looked up.

## 0.11.1 (2026-09-26)

- Jobs pay ¥10 a turn (¥20 a delivery), so a player who gets most replies right can keep up with the rent.

## 0.11.0 (2026-09-26)

- All 150 HSK 1 words: Old Chen's tea house, your neighbour Mrs Lin and her family, a Chinese class with David, Old Ma's taxi stand, Mr Li on the phone, the doctor and the lunch rush.
- Full pay only when you get a reply right the first time.

## 0.10.0 (2026-09-26)

- Wash dishes for the cook, then haggle over apples at the corner shop and buy things with your own money.

## 0.9.0 (2026-09-26)

- Deliveries: Miss Gao hands you a parcel and names the place; walk it to the school, the hospital or the train station.

## 0.8.0 (2026-09-25)

- The warehouse: Big Liu counts you to ten and gives you work; Mr Li tells you the rent.

## 0.7.0 (2026-09-25)

- Your room and the landlord; you sleep only at home.
- Counting with Old Wang before work.
- Your name is a reply tile.

## 0.6.2 (2026-09-25)

- A link to the source on GitHub; on phones the keyboard opens only when you type your name.

## 0.6.1 (2026-09-25)

- Phone keyboards can type your name.

## 0.6.0 (2026-09-25)

- The game asks your name and people use it; the version shows in the bottom border.

## 0.5.0 (2026-09-25)

- A real first conversation with Old Wang, and wrong answers you can read.

## 0.4.1 (2026-09-25)

- Tile replies are explained the first time, and you can back out of them.

## 0.4.0 (2026-09-25)

- What your replies do is told as a story; a notebook of the words you have met; a mentor who explains usage; export and import of games.
- The game in the browser, playable on a phone.

## 0.3.1 (2026-09-25)

- A fix to the greetings lesson, and small polish.

## 0.3.0 (2026-09-25)

- Several games side by side: `--new` starts another, `--resume` picks one.

## 0.2.0 (2026-09-25)

- A story to start with, greetings first, and the English meaning of every line.

## 0.1.1 (2026-09-25)

- A clearer reply prompt.

## 0.1.0 (2026-09-25)

- The first terminal demo, playable with `npx silver-tongue`.
