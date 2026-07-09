# Applies the just-recomputed active cruise speed (.spcur -- the shared
# speed_step wrote it: the sky cruise .skyspd while sky mode owns the ride,
# else the land speed .speed) to the minecart max-speed gamerule, then reports
# the new value. While the ocean speed-up is cruising fast (.fast 1) the
# gamerule is left to it -- .spcur is still updated underneath, and speed_down
# re-applies .speed at the next transition back to land. Sky mode no longer
# blocks the apply the way it used to: in sky mode .spcur IS the sky cruise, so
# a Speed +/- or Reset click in sky mode now takes effect immediately.
execute if score .fast ir matches 0 store result storage infinite_rail:speed v int 1 run scoreboard players get .spcur ir
execute if score .fast ir matches 0 run function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .spdflt ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s","color":"gray"}]
execute if score .spdflt ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s (default)","color":"gray"}]
