# Silver Tongue

> You arrive speaking pidgin; you leave with a silver tongue.

A language-learning life game. You arrive in a new city knowing a few words and earn your living by understanding people. Every job, purchase and conversation happens in the language you're learning.

The first course is Mandarin (HSK 1), in a Chinese city, explained in English.

## Play in the terminal

```sh
npx silver-tongue
```

| Key | Does |
|---|---|
| `1`–`9` | choose from the menu, or pick a reply |
| `w` | word help: look up a word from the last line |
| `enter` / `⌫` | say / undo, when building a reply from tiles |
| `esc` | back |
| `q` | save and quit (from the menu) |

Progress saves automatically to `~/.config/silver-tongue/<course>.json` (or under `$XDG_CONFIG_HOME`, or `%APPDATA%` on Windows). If a save can't be read, it is kept next to it as `<course>.json.invalid-backup` and a new game starts. If saving fails, the game says so and plays on without saving.

## Play from source

```sh
npm install
npm run build:course
npm run play
```

## License

MIT. See `LICENSE`.
