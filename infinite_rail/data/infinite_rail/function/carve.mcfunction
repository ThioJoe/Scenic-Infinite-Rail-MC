# Carves this column's clearance bore: 3 wide (Z-1..Z+1), from the rail cell up
# to the configured number of blocks above it. The height is a macro arg
# because fill needs literal coordinates, not scoreboard values. Called by the
# place_* functions, positioned at the head; the caller stores the height into
# infinite_rail:carve h first (#TUNNEL for flat columns, #TUNNELUP for slopes).
$fill ~ ~ ~-1 ~ ~$(h) ~1 minecraft:air
