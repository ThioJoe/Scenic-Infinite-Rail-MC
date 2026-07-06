# Snaps the ir_probe marker onto the TERRAIN surface at the current X/Z.
# Two passes:
#   1. the motion_blocking_no_leaves heightmap (ignores tree canopy and
#      collision-less foliage, counts water/lava surfaces -- oceans read as
#      sea level and get bridged);
#   2. a dig-down through everything in #infinite_rail:not_terrain -- tree
#      trunks, giant mushrooms, bamboo, and man-made structure blocks
#      (village roofs, planks, glass, wool...), plus the air pockets under
#      them (house interiors, the space under a mushroom cap) -- so trees
#      and buildings never read as ground.
# Water is deliberately NOT in the tag: the dig stops on a liquid surface,
# exactly like the heightmap. Callers read the result from the probe's
# Pos[1] afterwards (the Y one above the surface block, same convention as
# the plain heightmap snap this replaces).
# Must run positioned at the sample column (any Y). See CONTEXT.md 7a.
execute positioned over motion_blocking_no_leaves run tp @e[type=marker,tag=ir_probe,limit=1] ~ ~ ~
execute at @e[type=marker,tag=ir_probe,limit=1] if block ~ ~-1 ~ #infinite_rail:not_terrain run function infinite_rail:probe_down
