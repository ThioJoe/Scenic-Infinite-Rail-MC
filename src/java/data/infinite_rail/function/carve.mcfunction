# Carves this column's clearance bore: 3 wide (Z-1..Z+1), from the rail cell
# up to .ch blocks above it (.TUNNELCLEAR for flat columns, .TUNNELUP for slopes --
# the caller sets both the .ch score and storage infinite_rail:carve h before
# calling). Runs positioned at the head (the rail cell).
#
# The bore is VEGETATION-SPARING (see the shared vegetation.js and the
# #infinite_rail:keep block tag the build generates from it): only the
# critical envelope is cleared unconditionally, and everything else is
# cleared per-cell UNLESS the block there is natural vegetation -- so the
# ride brushes through forests instead of mowing a square canyon, while
# stone/dirt/sand still carve into the usual clean tunnels.
#
#   - The rail cell and the cell above it (center): ALWAYS cleared -- the
#     cart and rider pass through here.
#   - The rest of the center bore (>= 2 above the rail): cleared
#     unconditionally when .veg is 0 (slope columns and the .SLOPECLEAR
#     columns around them -- the camera floats above the rail line there;
#     the shared decide computes .veg), vegetation-sparing otherwise.
#   - Left and right of the track: ALWAYS vegetation-sparing, at every
#     height (trees right beside the line survive even on slopes).

# The critical envelope: rail cell + 1 above, center only.
fill ~ ~ ~ ~ ~1 ~ minecraft:air

# Slope / slope-buffer columns: the full center bore in one fill (the height
# is a macro arg -- fill needs literal coordinates).
execute if score .veg ir matches 0 run function infinite_rail:carve_center with storage infinite_rail:carve

# Everything else is per-cell: walk the bore bottom-to-top (see carve_layer).
scoreboard players set .cy ir 0
function infinite_rail:carve_layer
