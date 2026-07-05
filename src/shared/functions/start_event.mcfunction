# Begins a climb or descent in direction .want. This column becomes the first
# sloped column of the event; the event will keep sloping (via decide) every
# following column until it reaches the target elevation.
scoreboard players operation .dir ir = .want ir
scoreboard players operation .slope ir = .want ir
scoreboard players operation .lastDir ir = .want ir
scoreboard players set .flat ir 0
# A slope is starting: ask the edition's builder to retroactively clear the
# full center bore of the last .SLOPECLEAR (already flat) columns -- the
# camera lifts off the rail line BEFORE the slope arrives, so overhanging
# vegetation spared there must go after all. The builder consumes this flag
# and resets it to 0 (see decide's carve-mode block).
scoreboard players set .retro ir 1
