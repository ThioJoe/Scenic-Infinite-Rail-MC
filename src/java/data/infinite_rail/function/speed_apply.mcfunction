# Applies the just-recomputed active cruise speed (.spcur -- the shared
# speed_step wrote it: the sky cruise .skyspd in sky mode, the ocean cruise
# .ocnspd during an ocean sprint, else the land speed .speed) to the minecart
# max-speed gamerule, then reports the new value. Unconditional on purpose:
# speed_step already tuned the score that owns the gamerule RIGHT NOW, so a
# Speed click applies immediately in every context (an ocean-sprint click
# used to be deferred to the next transition; now it tunes the ocean cruise
# itself, and speed_up keeps re-asserting the same value every ocean chunk).
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .spcur ir
function infinite_rail:set_speed with storage infinite_rail:speed
execute if score .spdflt ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s","color":"gray"}]
execute if score .spdflt ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s (default)","color":"gray"}]
