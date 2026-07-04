# Advance the smoothed rail-line height #sy toward the target #ty (both in
# milliblocks): close 1/#CAMSMOOTH of the remaining gap per tick, in either
# direction. Climbs ease toward the early-rising forward-max target and
# decelerate into hilltops; descents ease down after the line drops away --
# the same glide, mirrored. The step is capped at 1 block/tick as a jolt
# guard, and the result is floored at the rail line so the rig can never sink
# into the track, whatever the numbers do.
scoreboard players operation #dy ir = #ty ir
scoreboard players operation #dy ir -= #sy ir
scoreboard players operation #dy ir /= #CAMSMOOTH ir
execute if score #dy ir matches 1001.. run scoreboard players set #dy ir 1000
scoreboard players operation #sy ir += #dy ir
execute if score #sy ir < #linem ir run scoreboard players operation #sy ir = #linem ir
