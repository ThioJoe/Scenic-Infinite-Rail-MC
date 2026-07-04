# Places one climbing track column (rail ascends 1 block toward the east) on a
# hidden block of redstone. Extra headroom is carved since the cart rises here.
fill ~ ~ ~-1 ~ ~5 ~1 minecraft:air
setblock ~ ~ ~ minecraft:powered_rail[shape=ascending_east,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
function infinite_rail:support
