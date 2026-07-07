# Mode toggle:  /function infinite_rail:mode_sound_off
# Silence the ride (the classic glide). stopsound cuts the tail of the
# currently-playing riding-sample copy (up to ~5.8 s long), so the toggle
# is instant instead of finishing the loop it is in.
scoreboard players set .SOUNDMODE ir 0
stopsound @a neutral minecraft:entity.minecart.inside
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Minecart sound off.","color":"gray"}]
