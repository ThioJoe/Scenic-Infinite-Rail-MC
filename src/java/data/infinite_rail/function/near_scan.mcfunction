# The near-ground scan feeding the shared brain's slope-timing guards
# (decide's .dig/.dig2/.push/.due and consider_start's start rules --
# CONTEXT.md section 7j). Probes the surface heightmap every 2 blocks over
# the next max(.UPLOOK, .DOWNLOOK) blocks east of the head (odd offsets +1,
# +3, +5, ...). Consecutive probes are folded into PAIRS -- min(this, prev)
# -- because the heightmap counts tree trunks as ground: a 1-2 block wide
# spike only ever catches one probe of a pair, so the min erases it, while
# real terrain (4+ blocks wide) spans both probes and registers. The pairs
# boil down to three scores for the shared decide:
#   .gfloor = highest pair within .DOWNLOOK (the descent guard: a down-step
#             may never land below .gfloor + .DOWNGRACE)
#   .gmax   = highest pair within .UPLOOK (the climb contact trigger)
#   .gcone  = the climb SCHEDULE: over pairs that are actually in the way
#             (above .railY - .HOVER -- ground the line already clears level
#             does not need climbing for), the highest 45-degree projection
#             pair_height - pair_distance: the height the rail must already
#             be at for a 45-degree ramp from here to crest what is coming.
# Sentinels: .gfloor/.gmax start at -10000 (their guards fail open without
# data); .gcone stays -10000 when nothing ahead needs climbing (the
# schedule gate HOLDS -- there is nothing to be due for) but falls back to
# +32000 if the scan got no valid probes at all (.gnu counts them), so
# missing terrain reverts to plain average-driven behavior. Must run
# positioned at the head marker, like sample_window. Capped at 48 blocks --
# the sample window's own reach, always inside the generated corridor.
scoreboard players operation .nw ir = .UPLOOK ir
scoreboard players operation .nw ir > .DOWNLOOK ir
execute if score .nw ir matches 49.. run scoreboard players set .nw ir 48
scoreboard players set .gfloor ir -10000
scoreboard players set .gmax ir -10000
scoreboard players set .gcone ir -10000
scoreboard players operation .gbase ir = .railY ir
scoreboard players operation .gbase ir -= .HOVER ir
scoreboard players set .gnu ir 0
scoreboard players set .sprev ir -32000
scoreboard players set .nk ir 1
execute if score .nw ir matches 1.. positioned ~1 ~ ~ run function infinite_rail:near_step
execute if score .gnu ir matches 0 run scoreboard players set .gcone ir 32000
