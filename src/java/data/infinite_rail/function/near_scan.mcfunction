# The near-ground scan feeding the shared brain's slope-timing guards
# (decide's .dig/.dig2/.push/.due and consider_start's start rules --
# CONTEXT.md section 7j). Probes the surface every 2 blocks over the next
# .SAMPLE_WINDOW blocks east of the head (odd offsets +1, +3, +5, ...) via
# probe_surface (heightmap + the not-terrain dig-down, so trees and
# structures are already invisible). Consecutive probes are folded into
# PAIRS -- min(this, prev) -- to erase what the dig-down can't: a 1-2 block
# wide spike of REAL terrain (rock fins, lone pillars) only ever catches
# one probe of a pair, so the min drops it, while real ground (4+ blocks
# wide) spans both probes and registers. The pairs boil down to three
# scores for the shared decide:
#   .gfloor = highest pair within .DOWNLOOK_AHEAD (the descent guard: a
#             down-step may never land below .gfloor - .PLOW_GRACE_DOWN)
#   .gmax   = highest pair anywhere in the walk (the climb contact trigger
#             -- the climb side has no reach knob, it always uses the full
#             sample window, the line's whole planning horizon)
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
# positioned at the head marker, like sample_window. The reach IS the
# sample window (floored at 1), so the scan never reads past the sampling
# horizon -- keep .SAMPLE_WINDOW <= .TERRAIN_GENAHEAD so both stay inside
# the generated corridor.
scoreboard players operation .nw ir = .SAMPLE_WINDOW cfg_terrain
execute unless score .nw ir matches 1.. run scoreboard players set .nw ir 1
scoreboard players set .gfloor ir -10000
scoreboard players set .gmax ir -10000
scoreboard players set .gcone ir -10000
scoreboard players operation .gbase ir = .railY ir
scoreboard players operation .gbase ir -= .HOVER cfg_terrain
scoreboard players set .gnu ir 0
scoreboard players set .sprev ir -32000
scoreboard players set .nk ir 1
execute if score .nw ir matches 1.. positioned ~1 ~ ~ run function infinite_rail:near_step
execute if score .gnu ir matches 0 run scoreboard players set .gcone ir 32000
