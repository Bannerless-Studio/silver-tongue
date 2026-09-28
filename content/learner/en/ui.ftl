# Text-game UI. Every id here is required by packages/tui (UI_KEYS).

# The top border (right) and the HUD row under it.
hud-top = Day { $day }
hud-goal = Next: { $goal }
hud-goal-sleep = Next: find your bed
hud-rent = { $days ->
    [0] rent due tonight
    [one] rent due tomorrow
   *[other] rent in { $days } days
}
hud-rent-late = rent late
hud-parcel = parcel
credit = by Bannerless Studio

rank-0 = Pidgin
rank-1 = Getting By
rank-2 = Conversational
rank-3 = Fluent
rank-4 = Silver Tongue

menu-title = What now?
menu-talk = { $scene } · { $npc }
menu-go = Go to { $place }
menu-needs-money = { $npc }: { $scene } · needs { $currency }{ $cost }
menu-mentor = Ask { $npc } about the language
menu-no-time = no time left
menu-cost-money = { " · " }{ $currency }{ $cost }
menu-sleep = Sleep (end the day)
menu-quit = Save and quit

keys-explore = [{ $keys }] choose · [n] notebook · [q] quit
keys-pick = [{ $keys }] reply · [w] help · [r] again · [n] notebook
keys-tiles = [{ $keys }] add · [⌫] undo · [enter] say · [w] help · [r] again · [n] notebook
keys-help = [{ $keys }] look up · [p] play · [esc] back
keys-help-sentence = [{ $keys }] look up · [s] whole sentence · [p] play · [esc] back

help-title = Which word?
help-sentence = The whole sentence
help-example = e.g.
help-play = [p] ♪
help-in-replies = In the replies:
reply-title = Your reply
reply-confused = Look confused
tiles-answer = You say:
you = You

mismatch = That's not what was asked.
rephrased = (slower)
# Bottom border, right: sound playing, turned off with m, or no way to play it here.
sound-on = ♪ [m]
sound-off = ♪ off [m]
sound-none = no audio
wallet-change = { $sign }{ $currency }{ $amount } ({ $reason })
reason-wages = wages
reason-mixup = mix-up
reason-food = food
reason-rent = rent
reason-shopping = shopping
trust-up = { $npc } trusts you a little more.
scene-done = { $earned ->
    [0] Done.
   *[other] Done. You earned { $currency }{ $earned }.
}
scene-done-short = Done.
unlocked = New: { $scene }
unlocked-many = New: { $scenes }
place-revealed = { $count ->
    [one] New place: { $places }
   *[other] New places: { $places }
}
errand-started = You're carrying a parcel.
errand-ended = You hand over the parcel.
rank-up = You're now: { $rank }
day-ended = Day { $day } is over. You sleep.
day-ended-rough = Day { $day } is over. You sleep rough by the road.
reject-unknown-scene = There's nobody here for that.
reject-in-scene = Finish the conversation first.
reject-wrong-place = They're not here.
reject-locked = They're not ready to talk about that yet.
reject-no-slots = You're out of time today. Go and find your bed.
reject-stale-run = That conversation can't continue. Start it again.
reject-no-pick = Choose a reply with the number keys.
reject-bad-choice = There's no reply with that number.
reject-no-tiles = Build your reply from the tiles.
reject-bad-tile = There's no tile with that number.
reject-not-linked = You can't get there from here.
reject-not-home = You want your own bed. Head home first.
reject-unknown-word = That word isn't in the dictionary.
notice-read-only = Your progress can't be saved on this computer, so this session won't be kept.
notice-bad-save = Your save couldn't be read. It was kept as a backup and a new game started.

resume-title = Your games:
resume-item = { $name }Day { $day } · { $place } · { $currency }{ $wallet } · { $done ->
    [one] 1 scene done
   *[other] { $done } scenes done
} · last played { $date }
resume-ask = Which one? (number, or enter to cancel)
resume-none = No saved games yet, so here's a new one.
reject-no-mentor = There's nobody here to explain things.
note-hint = { $npc } seems to have something to tell you.
mentor-nothing = { $npc } has nothing new to explain today.

keys-notebook = [esc] back · [1-2] tab · [↑↓←→] move · [enter] more · [p] play
notebook-title = Notebook
notebook-words = Words
notebook-recent = Recent
notebook-notes-empty = No notes yet. Ask around; someone will explain things.
notebook-label-new = new
notebook-label-met = met
notebook-label-shaky = shaky
notebook-label-known = known
notebook-rank = Speaks: { $rank }
notebook-progress = Stage { $stage }: { $known } of { $total } words known
notebook-empty = Nothing yet. Words you hear are written down here.
notebook-elsewhere = Heard elsewhere
notebook-notes = Notes
export-none = There's no saved game to export yet.
import-bad = That line isn't a saved game for this course ({ $reason }).
import-done = Added: { $game }. Run the game to continue it.

# Browser page controls (packages/tui-web).
web-new = New game
web-games = Games
web-games-none = No saved games yet.
web-export = Export
web-export-hint = This line is your whole game. Paste it into Import on another device, or into the terminal game with: npx silver-tongue --import -
web-copy = Copy
web-copied = Copied
web-import = Import
web-import-hint = Paste a line from Export, here or from the terminal game. It is added as a new game; nothing is overwritten.
web-import-go = Add game
web-close = Close
web-tap-to-type = Tap the game to type your name.
web-saved = Your game is saved. You can close this tab, or keep playing.
web-load-failed = That course did not load. Check your connection and try again.
reject-bad-name = That name won't work. Use 1 to 20 letters.
reject-no-name = Tell us your name first.
name-prompt = Before anything else: what's your name?
keys-name = type your name · [enter] done · [⌫] delete

## Languages, by code, for the settings screen and the start list
learner-name = English
language-zh = Chinese
language-ja = Japanese

## Settings ([o])
settings-title = Settings
settings-learning = Learning: { $language }
settings-reading = Reading: { $learner }
settings-sound = Sound: { $sound }
settings-sound-on = on
settings-sound-off = off
settings-sound-none = no audio
settings-sound-hint = (or [m])
settings-speed = Speed: { $speed }
settings-speed-slow = slow
settings-speed-normal = normal
settings-speed-fast = fast
settings-pick-course = Learn:
settings-pick-reading = Read the game in:
settings-current = (now)
keys-settings = [{ $keys }] change · [esc] back
keys-settings-pick = [{ $keys }] choose · [esc] back
keys-o = [o] settings

## Choosing a course before the game starts
start-title = What do you want to learn?
start-ask = Number (enter to quit):

# Visual novel
vn-tagline = You arrive speaking pidgin; you leave with a silver tongue.
vn-continue = Continue
vn-new-game = New game
vn-tap = Tap to continue
vn-notebook = Notebook
vn-backlog = What was said
vn-settings = Settings
vn-games = Games
vn-menu = Menu
vn-play-text = Play as text
vn-play-visual = Visual novel
vn-replay = Say it again
vn-slow = Say it slowly
vn-meaning = What does it mean?
vn-undo = Take back a tile
vn-send = Say it
vn-name-go = That's me
vn-sound = Sound
vn-speed = Speed: { $speed }
vn-speed-slow = slow
vn-speed-normal = normal
vn-speed-fast = fast
vn-advance = Advance: { $mode }
vn-advance-auto = by itself
vn-advance-tap = one press at a time
vn-day = Day { $day }
vn-parcel = Carrying a parcel
vn-rent-late = Rent is late
vn-turn-phone = Turn your phone sideways for a bigger view.
vn-dismiss = Got it
vn-play-word = Hear it

# NPC gesturing after two wrong replies, alongside the slow repeat.
gesture-narration = { $npc } mimes it:
