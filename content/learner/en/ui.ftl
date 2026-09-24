# Text-game UI. Every id here is required by packages/tui (UI_KEYS).

hud = Day { $day } · slot { $slot }/{ $slots } · { $currency }{ $wallet } · { $rank }

rank-0 = Pidgin
rank-1 = Getting By
rank-2 = Conversational
rank-3 = Fluent
rank-4 = Silver Tongue

menu-title = What now?
menu-talk = Talk to { $npc }: { $scene }
menu-go = Go to { $place }
menu-sleep = Sleep (end the day)
menu-quit = Save and quit

keys-explore = [1-9] choose · [q] quit
keys-pick = [1-4] reply · [w] word help
keys-tiles = [1-9] add tile · [⌫] undo · [enter] say it · [w] word help
keys-help = [1-9] look up · [esc] back

help-title = Which word?
tiles-answer = You say:

mismatch = That's not what they asked for.
rephrased = (slower)
wallet-change = { $sign }{ $currency }{ $amount } ({ $reason })
reason-wages = wages
reason-mixup = mix-up
reason-food = food
reason-rent = rent
trust-up = { $npc } trusts you a little more ({ $trust }).
scene-done = Done. You earned { $currency }{ $earned }.
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
notice-bad-save = Your save couldn't be read. It was kept as a backup and a new game started.
