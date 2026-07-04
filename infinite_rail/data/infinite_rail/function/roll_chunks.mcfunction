# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.

# Force-generate terrain #GENAHEAD blocks ahead of the head (so the heightmap
# scanner always has real data) and release chunks far behind; there is no
# going back. forceload needs literal coordinates, so the configurable distance
# is handed to a macro.
execute store result storage infinite_rail:args gen int 1 run scoreboard players get #GENAHEAD ir
function infinite_rail:forceload with storage infinite_rail:args
# Keep world spawn and respawn points moving with the ride so nothing is
# anchored to the origin.
setworldspawn ~ ~1 ~
spawnpoint @a ~ ~1 ~
scoreboard players add #nextLoad ir 16
