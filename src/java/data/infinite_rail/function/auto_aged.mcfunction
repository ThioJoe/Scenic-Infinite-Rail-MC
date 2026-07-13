# The auto-start world-age gate tripped (see auto_gate): this world has
# already been played for a while, so do NOT auto-start into it. Latch
# .autodone so the auto-starter stays down for good and never re-warns (a
# manual /function infinite_rail:start still works), then explain why and how
# to start deliberately if the player really wants the ride here.
scoreboard players set .autodone ir 1
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"This world looks like it has already been played for a while, so the ride did NOT auto-start.","color":"yellow"}]
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Scenic Rail Mode is meant for a FRESH world: it bulldozes a tunnel straight through everything in its path (your builds included), kills entities the cart passes and leaves behind, and locks you into the cart in adventure mode for the whole ride.","color":"gray"}]
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"If you really do want to run it here anyway, start it manually with ","color":"gray"},{"text":"/function infinite_rail:start","color":"aqua"},{"text":".","color":"gray"}]
