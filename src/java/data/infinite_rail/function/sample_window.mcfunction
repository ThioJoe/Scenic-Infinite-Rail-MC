# Samples the terrain surface every .SAMPLE_BLOCK_INTERVAL blocks over the
# next .SAMPLE_WINDOW blocks east of the head, into .sum -- .winn samples
# total (the derived divisor advance uses for the average: .SAMPLE_WINDOW /
# .SAMPLE_BLOCK_INTERVAL, i.e. 12 at the defaults 48 / 4, sampling
# +4, +8, ... +48 exactly like the fixed twelve-stanza unroll this replaces).
# Must run positioned at the head marker.
#
# Each sample runs probe_surface: the motion_blocking_no_leaves heightmap
# (ignores tree canopy, includes water/lava surfaces so oceans read as sea
# level) plus the dig-down through #infinite_rail:not_terrain (tree trunks,
# village houses... -- see probe_surface), so only real ground and liquid
# surfaces count as terrain.
#
# Each sample is clamped to at most .DOWNCLAMP below the previous window
# average: narrow ravines/holes barely move the target (they get bridged
# level, per the "ignore the sudden dip" rule). There is deliberately no
# upward clamp -- approaching mountains register at their full height, so
# the target rises early for a "one swoop" climb. A reading at or below
# Y-63 (void / ungenerated chunk) is discarded entirely (it counts as the
# previous average).
#
# The walk itself is a sample_hop/sample_step recursion (mcfunction has no
# loops); positions can't come from scoreboards, so the hop distance goes
# through storage into the sample_hop macro.
scoreboard players operation .lo ir = .avg ir
scoreboard players operation .lo ir -= .DOWNCLAMP cfg_terrain
# Derived count: floor(.SAMPLE_WINDOW / .SAMPLE_BLOCK_INTERVAL), each side
# floored at 1 so a zero/negative knob can neither hop in place nor hand
# advance a divide-by-zero.
scoreboard players operation .wstep ir = .SAMPLE_BLOCK_INTERVAL ir
execute unless score .wstep ir matches 1.. run scoreboard players set .wstep ir 1
scoreboard players operation .winn ir = .SAMPLE_WINDOW cfg_terrain
scoreboard players operation .winn ir /= .wstep ir
execute unless score .winn ir matches 1.. run scoreboard players set .winn ir 1
execute store result storage infinite_rail:samp dx int 1 run scoreboard players get .wstep ir
scoreboard players set .wk ir 0
function infinite_rail:sample_hop with storage infinite_rail:samp
