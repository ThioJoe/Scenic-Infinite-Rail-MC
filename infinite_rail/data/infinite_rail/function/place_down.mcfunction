# Places one descending track column (rail is 1 lower than the previous column,
# sloping up toward the west behind it) on a hidden block of redstone.
# Support must be placed before the rail (see place_flat).
fill ~ ~ ~-1 ~ ~5 ~1 minecraft:air
function infinite_rail:support
setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_west,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
