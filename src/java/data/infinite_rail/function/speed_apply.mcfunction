# Applies the adjusted land cruising speed (.speed -- the shared speed_step
# just recomputed it) to the minecart max-speed gamerule, then reports the
# new value. While the ocean speed-up is cruising fast (.fast 1) or sky mode
# owns the speed (.SKYMODE 1) the gamerule is left to its current owner --
# .speed still updated, and it takes over at the next transition back to
# normal pace (speed_down / mode_sky_off restore .speed, not .MAXSPEED).
execute if score .fast ir matches 0 if score .SKYMODE ir matches 0 store result storage infinite_rail:speed v int 1 run scoreboard players get .speed ir
execute if score .fast ir matches 0 if score .SKYMODE ir matches 0 run function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .spdflt ir matches 0 run tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" blocks/s","color":"gray"}]
execute if score .spdflt ir matches 1 run tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".speed","objective":"ir"},"color":"white"},{"text":" blocks/s (default)","color":"gray"}]
