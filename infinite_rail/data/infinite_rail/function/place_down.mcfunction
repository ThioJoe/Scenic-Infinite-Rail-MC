# Places one descending track column (rail is 1 lower than the previous
# column, sloping up toward the west behind it).
fill ~ ~ ~-1 ~ ~5 ~1 minecraft:air
setblock ~ ~-3 ~ minecraft:smooth_stone
setblock ~ ~-2 ~ minecraft:redstone_torch
setblock ~ ~-1 ~ minecraft:smooth_stone
setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_west,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
