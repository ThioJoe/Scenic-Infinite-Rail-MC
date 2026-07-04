# Places one flat track column: a powered rail on a hidden block of redstone
# (disguised as smooth stone by a display), plus a light block above. Carving
# 3 wide x 5 tall handles tunnels through mountains and cuts through forests;
# over open ground it just clears air.
# ORDER MATTERS: the support (redstone block) must exist before the rail is
# placed, or the rail lands on air (the track hovers above the ground) and
# immediately pops off.
fill ~ ~ ~-1 ~ ~4 ~1 minecraft:air
function infinite_rail:support
setblock ~ ~ ~ minecraft:powered_rail[shape=east_west,powered=true]
setblock ~ ~3 ~ minecraft:light[level=11]
