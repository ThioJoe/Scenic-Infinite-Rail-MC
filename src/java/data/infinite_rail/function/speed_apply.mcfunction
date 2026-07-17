# Applies the just-recomputed active cruise speed (.spcur -- the shared
# speed_step wrote it: the sky cruise .skyspd in sky mode, the ocean cruise
# .ocnspd during an ocean sprint, else the land speed .speed) to the minecart
# max-speed gamerule, then reports the new value. Unconditional on purpose:
# speed_step already tuned the score that owns the gamerule RIGHT NOW, so a
# Speed click applies immediately in every context (an ocean-sprint click
# used to be deferred to the next transition; now it tunes the ocean cruise
# itself, and speed_up keeps re-asserting the same value every ocean chunk).
# The gamerule holds a MAGNITUDE; the sign (0 = parked, negative = reverse)
# stays in the scores and main's .curtgt turns it into the pace cart's
# motion direction -- speed_push takes |.spcur|.
scoreboard players operation .spush ir = .spcur ir
function infinite_rail:speed_push
# Report: negative values print with their minus sign as-is; 0 says so.
execute if score .spcur ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s (stopped)","color":"gray"}]
execute unless score .spcur ir matches 0 if score .spdflt ir matches 0 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s","color":"gray"}]
execute unless score .spcur ir matches 0 if score .spdflt ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Ride speed: ","color":"gray"},{"score":{"name":".spcur","objective":"ir"},"color":"white"},{"text":" blocks/s (default)","color":"gray"}]
