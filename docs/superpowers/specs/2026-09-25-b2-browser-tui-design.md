# Milestone B2: browser TUI

2026-09-25 · status: approved in conversation ("Do b2")

The same text game in a web page. `packages/tui` already runs against a `Terminal` interface; B2 adds a browser backend for it and a page to host it. Nothing about play changes.

## Package: `packages/tui-web`

- **`web-terminal.ts`:** `createWebTerminal(xterm, fit)` implements `Terminal` on xterm.js (`@xterm/xterm`, `@xterm/addon-fit`, bundled rather than taken from a CDN).
  - `write` clears the screen and draws the frame. The line styling (`toAnsi`) moves from `tui-node` into `packages/tui/src/ansi.ts`, so both backends colour lines the same way.
  - `size` comes from xterm's `cols` and `rows`. `onResize` runs after `fit()` when the window or the phone's orientation changes.
  - Keys come from xterm's `onKey`: a DOM key maps to our key names with `keyName(domKey)`. So Enter becomes `return`, Escape `escape`, Backspace `backspace`, the arrows `up`/`down`/`left`/`right`, and a single character stays as it is. Everything else is ignored.
- **Key bar:** a row of buttons under the terminal for phones: `1`–`9`, `w`, `n`, `s`, `⌫`, `↵`, `esc`, `↑`, `↓`. Each sends the same key names. It's shown on touch screens (`pointer: coarse`) and hidden elsewhere.
- **Storage (`web-storage.ts`):** sessions in `localStorage`, like the Node sessions folder.
  - `silver-tongue:<course>:session:<id>` holds a save and `silver-tongue:<course>:last` the id played last.
  - Load, save and list go through a small `Storage`-like interface, so tests use a fake.
  - A save that won't parse is kept under `…:invalid-backup:<time>` and a new game starts with the usual notice.
  - If storage throws (private mode, quota), the game plays on without saving and shows `notice-read-only`.
- **Page controls** above the terminal:
  - **New game** starts a new session, keeping the others.
  - **Games** lists the sessions with the same text as `--resume` and switches to the one picked.
  - **Export** shows the save line (`st1:…`, the same format as the terminal game) with a Copy button.
  - **Import** takes a pasted line and adds it as a new session.
  - The codec is async in the browser (`CompressionStream("deflate-raw")`) but produces the same format as the Node one, so lines move between the terminal and the browser.
- **Quit:** on the web, "Save and quit" shows a short "Your game is saved" message in the log instead of closing anything.
- **Build:** `npm run build:web` bundles the app, xterm, its CSS and the built course into **one self-contained `index.html`** under `packages/tui-web/dist/`. It needs no server, so it works from a file, GitHub Pages or a shared link.

## Hosting

- A `pages.yml` workflow builds the page on every push to main and deploys it to GitHub Pages at `https://jamil314.github.io/silver-tongue/`.
- Turning Pages on for the repository is a one-time setting. It is outward-facing, so it happens only with the owner's OK.

## Testing

- Unit tests (Vitest, Node):
  - `keyName` mapping;
  - web storage with a fake `localStorage`: last session, new session, a broken save kept as backup, storage that throws;
  - the web codec round-trip, and cross-compatibility with the Node codec (Node 22 has `CompressionStream`).
- A headless smoke test with the local Chrome and `playwright-core`, run by hand and not in CI:
  - load `dist/index.html`;
  - see the intro;
  - press `1` twice and see Old Wang's line;
  - reload and see the game continue.

## Left out of B2

- Audio (B4).
- A service worker or offline install.
- Themes and font choices.
- Running the Playwright smoke test in CI.
