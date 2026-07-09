# Places one flat track column: a powered rail on a hidden block of redstone
# (disguised as smooth stone by a display), plus a light block above. Carving
# a 3-wide, .TUNNEL-tall vegetation-sparing bore handles tunnels through
# mountains and brushes through forests (trees/plants outside the critical
# envelope survive -- see carve); over open ground it just clears air.
# ORDER MATTERS: the support (redstone block) must exist before the rail is
# placed, or the rail lands on air (the track hovers above the ground) and
# immediately pops off.
# Carve height (.TUNNEL, blocks above the rail) is configurable; the light at
# ~3 assumes it is at least 3. It goes into both the .ch score (the per-cell
# carve walk) and storage h (the full-clear fill macro).
scoreboard players operation .ch ir = .TUNNEL cfg_terrain
execute store result storage infinite_rail:carve h int 1 run scoreboard players get .TUNNEL cfg_terrain
function infinite_rail:carve
function infinite_rail:support
setblock ~ ~ ~ minecraft:powered_rail[shape=east_west,powered=true]
function infinite_rail:place_light
