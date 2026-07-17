# Pushes a SIGNED cruise speed (.spush, blocks/s) into the minecart
# max-speed gamerule -- which only holds a MAGNITUDE. Since stop-and-reverse
# the cruise scores can be 0 (parked) or negative (the ride runs backwards):
# the sign lives in the scores (main's .curtgt drives the pace cart's motion
# direction from it) and the gamerule gets |.spush|. Every gamerule writer
# funnels through here (speed_apply, speed_up, speed_down, sky_speed,
# mode_sky_off, begin, rev_check) so no caller can ever feed the gamerule a
# negative. |x| without a constant: .spabs = -(x), overwritten with x when
# x was already >= 0. (A value of 0 is offered to the gamerule as-is; if
# the running version rejects 0, the set silently fails and main's parked
# motion-zeroing holds the cart still regardless.)
scoreboard players set .spabs ir 0
scoreboard players operation .spabs ir -= .spush ir
execute if score .spush ir matches 0.. run scoreboard players operation .spabs ir = .spush ir
execute store result storage infinite_rail:speed v int 1 run scoreboard players get .spabs ir
function infinite_rail:set_speed with storage infinite_rail:speed
