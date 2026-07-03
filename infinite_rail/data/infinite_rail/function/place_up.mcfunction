# Places one climbing track column (rail ascends 1 block toward the east).
# Extra headroom is carved since the cart rises through this column.
fill ~ ~ ~-1 ~ ~5 ~1 minecraft:air
setblock ~ ~-3 ~ minecraft:smooth_stone
setblock ~ ~-2 ~ minecraft:redstone_torch
setblock ~ ~-1 ~ minecraft:smooth_stone
setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_east,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
