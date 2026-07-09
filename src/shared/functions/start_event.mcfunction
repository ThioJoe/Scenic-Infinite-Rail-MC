# Begins a climb or descent in direction .want. This column becomes the first
# sloped column of the event; the event will keep sloping (via decide) every
# following column until it reaches the target elevation.
scoreboard players operation .dir ir = .want ir
scoreboard players operation .slope ir = .want ir
scoreboard players operation .lastDir ir = .want ir
scoreboard players set .flat ir 0
# Restart the event-size counter (the big-event gap credit's input): decide
# increments it on every sloped column, so this event's first column counts
# 1 right after this call. Until now it still held the PREVIOUS event's
# size, which consider_start just used to shrink this event's required gap.
scoreboard players set .evrun ir 0
# A slope is starting: ask the edition's builder to retroactively clear the
# full center bore of the last .SLOPECLEAR (already flat) columns -- the
# camera lifts off the rail line BEFORE the slope arrives, so overhanging
# vegetation spared there must go after all. The builder consumes this flag
# and resets it to 0 (see decide's carve-mode block).
scoreboard players set .retro ir 1
