# (a function macro) The retroactive center-bore clear behind the head when a
# slope starts (see retro_clear, which computes and stores the args): columns
# ~-k..~0 at the current rail level, from 2 above the rail to the top of the
# flat bore. fill needs literal coordinates, so both distances arrive as
# macro args (storage infinite_rail:carve k and h).
$fill ~-$(k) ~2 ~ ~ ~$(h) ~ minecraft:air
