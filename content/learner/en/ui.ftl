# Text-game UI. Every id here is required by packages/tui (UI_KEYS).

hud = Day { $day } · slot { $slot }/{ $slots } · { $currency }{ $wallet } · { $rank }{ $rentLate ->
    [yes] { " · rent due" }
   *[no] {""}
}

rank-0 = Pidgin
rank-1 = Getting By
rank-2 = Conversational
rank-3 = Fluent
rank-4 = Silver Tongue

menu-title = What now?
menu-talk = Talk to { $npc }: { $scene }
menu-go = Go to { $place }
menu-mentor = Ask { $npc } about the language
cost-slot = { " · 1 slot" }
menu-sleep = Sleep (end the day)
menu-quit = Save and quit

keys-explore = [{ $keys }] choose · [n] notebook · [q] quit
keys-pick = [{ $keys }] reply · [w] word help · [n] notebook
keys-tiles = [{ $keys }] add tile · [⌫] undo · [enter] say it · [w] word help
keys-help = [{ $keys }] look up · [esc] back
keys-help-sentence = [{ $keys }] look up · [s] whole sentence · [esc] back

help-title = Which word?
help-sentence = The whole sentence
help-in-replies = In the replies:
reply-title = Your reply:
tiles-answer = You say:
you = You

mismatch = That's not what they asked for.
rephrased = (slower)
wallet-change = { $sign }{ $currency }{ $amount } ({ $reason })
reason-wages = wages
reason-mixup = mix-up
reason-food = food
reason-rent = rent
trust-up = { $npc } trusts you a little more ({ $trust }).
scene-done = { $earned ->
    [0] Done.
   *[other] Done. You earned { $currency }{ $earned }.
}
unlocked = New: { $scene }
rank-up = You're now: { $rank }
day-ended = Day { $day } is over. You sleep.
reject-unknown-scene = There's nobody here for that.
reject-in-scene = Finish the conversation first.
reject-wrong-place = They're not here.
reject-locked = They're not ready to talk about that yet.
reject-no-slots = You're out of time today. Sleep first.
reject-stale-run = That conversation can't continue. Start it again.
reject-no-pick = Choose a reply with the number keys.
reject-bad-choice = There's no reply with that number.
reject-no-tiles = Build your reply from the tiles.
reject-bad-tile = There's no tile with that number.
reject-not-linked = You can't get there from here.
reject-unknown-word = That word isn't in the dictionary.
notice-read-only = Your progress can't be saved on this computer, so this session won't be kept.
notice-bad-save = Your save couldn't be read. It was kept as a backup and a new game started.

resume-title = Your games:
resume-item = Day { $day } · { $place } · { $currency }{ $wallet } · { $done ->
    [one] 1 scene done
   *[other] { $done } scenes done
} · last played { $date }
resume-ask = Which one? (number, or enter to cancel)
resume-none = No saved games yet, so here's a new one.
reject-no-mentor = There's nobody here to explain things.
note-hint = { $npc } seems to have something to tell you.
mentor-nothing = { $npc } has nothing new to explain today.

keys-notebook = [↑↓] scroll · [esc] back
notebook-progress = Stage { $stage }: { $known } of { $total } words known · { $heard } heard
notebook-empty = Nothing yet. Words you hear are written down here.
notebook-elsewhere = Heard elsewhere
notebook-notes = Notes
export-none = There's no saved game to export yet.
import-bad = That line isn't a saved game for this course ({ $reason }).
import-done = Added: { $game }. Run the game to continue it.
