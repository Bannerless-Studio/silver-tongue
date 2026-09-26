# Silver Tongue

> You arrive speaking pidgin; you leave with a silver tongue.

A language-learning life game. Your phone is dead, your wallet is gone, and you're standing on a street in a Chinese city with ¥20 in your pocket. You start by telling the game your name. An old man on a bench teaches you your first words, and later explains how the language works when you ask; after that you earn your living by understanding people. Every job, purchase and conversation happens in the language you're learning.

The first course is Mandarin (HSK 1), in a Chinese city, explained in English.

## Play in the browser

https://bannerless-studio.github.io/silver-tongue/ — the same game, with an on-screen key bar on phones. Games save in the browser; Export and Import move a game between the browser and the terminal.

## Play in the terminal

```sh
npx silver-tongue            # continue the game you played last
npx silver-tongue --new      # start a new game (your other games are kept)
npx silver-tongue --resume   # choose one of your saved games
npx silver-tongue --export   # print the game you played last as one line of text
npx silver-tongue --import <line>   # add a game exported elsewhere (nothing is overwritten)
npx silver-tongue --import - < game.txt   # the same, reading the line from a file or a paste
npx silver-tongue --learn zh  # choose what to learn (a language or course id); remembered
npx silver-tongue --read en   # choose the language the game is written in; remembered
```

| Key | Does |
|---|---|
| `1`–`9` | choose from the menu, or pick a reply |
| `w` | word help: look up a word from the last line or the replies; `s` explains the whole sentence |
| `enter` / `⌫` | say / undo, when building a reply from tiles |
| `n` | notebook: every word you've heard, where you first heard it, and Old Wang's notes |
| `o` | settings: what you learn, what the game is written in, and sound |
| `esc` | back |
| `q` | save and quit (from the menu) |

Progress saves automatically. Each game is one file in `~/.config/silver-tongue/sessions/<course>/` (or under `$XDG_CONFIG_HOME`, or `%APPDATA%` on Windows); a save from 0.2.0 or earlier is moved there on first run. If a save can't be read, it is kept next to it as `<name>.json.invalid-backup` and a new game starts. If saving fails, the game says so and plays on without saving.

Needs Node 22 or newer.

## Play from source

```sh
npm install
npm run build:course
npm run play        # the terminal game
npm run build:web   # the browser game in packages/tui-web/dist (serve it: npx serve packages/tui-web/dist)
npm run bots        # scripted players through the course
```

The browser page fetches its course files, so it needs a web server; opening `index.html` straight from disk no longer works.

## License

MIT. See `LICENSE`.
