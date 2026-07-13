# One read of the stretch-shift scan (see shift_scan): pop the cached
# surface at offset .sk off the scratch walk (two removes = the walk
# advances 2 blocks east, odd offsets), lazily probing a slot nobody ever
# read (surf_prep -- once, cached for every later column), folds it with
# the previous read into a pair (.pmin = min of the two, near_scan's
# 1-2-block-spike eraser), and verifies the pair against the shifted
# descent's planned profile:
#   - everywhere: ground must stay at (or, with .PLOW_GRACE_DOWN, at most
#     that many levels above) the profile (railY - min(offset, .sD), i.e.
#     the 45-degree ramp then the landing) -- a shallow bump the carve can
#     cut through no longer fails the plan
#   - beyond the descent (.sk > .sD): ground must also stay AT the landing
#     level (>= .sband) -- the landing must be a real bottom, not a slope
#     that keeps falling away
# The first violation, or a void/ungenerated read, ends the verification
# (.sver keeps the horizon verified so far); otherwise .sver advances to
# this pair's far end and the walk recurses.
execute store result score .s ir run data get storage infinite_rail:surf w[0]
data remove storage infinite_rail:surf w[0]
data remove storage infinite_rail:surf w[0]
execute if score .s ir matches -32768 run scoreboard players operation .suo ir = .sk ir
execute if score .s ir matches -32768 run function infinite_rail:surf_prep
execute if score .s ir matches ..-63 run return 0
scoreboard players operation .pmin ir = .s ir
scoreboard players operation .pmin ir < .sp ir
# The tolerated ceiling at this pair: the planned profile railY -
# min(offset, descent), plus the .PLOW_GRACE_DOWN levels the swoop may cut
# through.
scoreboard players operation .scap ir = .sk ir
scoreboard players operation .scap ir < .sD ir
scoreboard players operation .slvl ir = .railY ir
scoreboard players operation .slvl ir -= .scap ir
scoreboard players operation .slvl ir += .PLOW_GRACE_DOWN cfg_terrain
# Violations end the verification at the last verified pair.
execute if score .sp ir matches -62.. if score .pmin ir > .slvl ir run return 0
execute if score .sp ir matches -62.. if score .sk ir > .sD ir if score .pmin ir < .sband ir run return 0
# Pair verified through its far end (needs a real previous read).
execute if score .sp ir matches -62.. run scoreboard players operation .sver ir = .sk ir
scoreboard players operation .sp ir = .s ir
scoreboard players add .sk ir 2
execute if score .sk ir <= .sH ir run function infinite_rail:shift_step
