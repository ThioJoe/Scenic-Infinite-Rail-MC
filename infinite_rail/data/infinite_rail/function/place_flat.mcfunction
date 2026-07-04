# Places one flat track column: a powered rail on a hidden block of redstone
# (disguised as smooth stone by a display), plus a light block above. Carving
# 3 wide x 5 tall handles tunnels through mountains and cuts through forests;
# over open ground it just clears air.
fill ~ ~ ~-1 ~ ~4 ~1 minecraft:air
setblock ~ ~ ~ minecraft:powered_rail[shape=east_west,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
function infinite_rail:support
