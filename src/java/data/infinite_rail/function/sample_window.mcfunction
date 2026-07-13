# Samples the terrain surface every .SAMPLE_BLOCK_INTERVAL blocks over the
# next .SAMPLE_WINDOW blocks east of the head, into .sum -- .winn samples
# total (the derived divisor advance uses for the average: .SAMPLE_WINDOW /
# .SAMPLE_BLOCK_INTERVAL). Must run positioned at the head marker.
#
# The heights come from the ROLLING SURFACE CACHE (surf_roll): each X ahead
# of the ride is probed once -- probe_surface's motion_blocking_no_leaves
# heightmap plus the dig-down through #infinite_rail:not_terrain (tree
# trunks, village houses... -- so only real ground and liquid surfaces count
# as terrain) -- on the first read, then every later column reads the cached
# value instead of re-probing the same block ~SAMPLE_WINDOW times as the
# window slides past it. The walk itself is a sample_step recursion popping
# the front of a scratch copy of the cache (literal-path data commands --
# no probes, no macros in the steady state).
#
# Each sample is clamped to at most .DOWNCLAMP below the previous window
# average: narrow ravines/holes barely move the target (they get bridged
# level, per the "ignore the sudden dip" rule). There is deliberately no
# upward clamp -- approaching mountains register at their full height, so
# the target rises early for a "one swoop" climb. A reading at or below
# Y-63 (void / ungenerated chunk) is discarded entirely (it counts as the
# previous average) -- and stays UNCACHED, so it is re-probed until the
# corridor has generated that terrain.
scoreboard players operation .lo ir = .avg ir
scoreboard players operation .lo ir -= .DOWNCLAMP cfg_terrain
# Derived count: floor(.SAMPLE_WINDOW / .SAMPLE_BLOCK_INTERVAL), each side
# floored at 1 so a zero/negative knob can neither walk in place nor hand
# advance a divide-by-zero.
scoreboard players operation .wstep ir = .SAMPLE_BLOCK_INTERVAL ir
execute unless score .wstep ir matches 1.. run scoreboard players set .wstep ir 1
scoreboard players operation .winn ir = .SAMPLE_WINDOW cfg_terrain
scoreboard players operation .winn ir /= .wstep ir
execute unless score .winn ir matches 1.. run scoreboard players set .winn ir 1
# Slide/rebuild the surface cache for this column (needs .winn/.wstep for
# its reach), then take a scratch copy for this walk to consume.
function infinite_rail:surf_roll
data modify storage infinite_rail:surf w set from storage infinite_rail:surf c
scoreboard players set .wk ir 0
scoreboard players set .wo ir 0
scoreboard players operation .wc ir = .wstep ir
function infinite_rail:sample_step
