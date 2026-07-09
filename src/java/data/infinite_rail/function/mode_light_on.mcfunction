# Mode toggle:  /function infinite_rail:mode_light_on
# Track light: bright (light level 11 -- the default, and the ice-melt-safe
# maximum). The invisible light block placed 3 above every NEW rail; already
# built track keeps whatever it was built with, like torch mode. See
# place_light for how .LIGHTMODE is read per column.
scoreboard players set .LIGHTMODE ir 11
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light ON - new track gets the bright line (the default).","color":"gray"}]
