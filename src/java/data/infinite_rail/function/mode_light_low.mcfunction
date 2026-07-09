# Mode toggle:  /function infinite_rail:mode_light_low
# Track light: low (light level 8) -- a dim glow above new track, subtler at
# night than the default 11 but still bright enough to keep mobs from
# spawning right on the line. New columns only, like torch mode.
scoreboard players set .LIGHTMODE ir 8
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Track light LOW - new track gets a dim glow.","color":"gray"}]
