# Macro half of roll_add_row: forceload only accepts literal/relative
# coordinates, so the reach (gen = .TERRAIN_GENAHEAD) and the row offset
# (dz = 0 / -15 / 15) arrive as macro args from storage infinite_rail:args.
# The explicit $return hands the forceload's own success to the caller
# (a function without a /return stores success 0 on modern versions).
$return run forceload add ~ ~$(dz) ~$(gen) ~$(dz)
