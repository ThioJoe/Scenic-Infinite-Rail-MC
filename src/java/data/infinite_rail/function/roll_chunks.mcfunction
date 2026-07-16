# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.

# Force-generate terrain .TERRAIN_GENAHEAD blocks ahead of the head (so the heightmap
# scanner always has real data) and release chunks far behind; there is no
# going back. forceload needs literal coordinates, so the distances (length,
# and a torch-mode-aware width) are computed into storage and handed to a
# macro -- see forceload_here.
# .flok is the success flag: preset to 0 here, set to 1 by forceload_here's
# store-success around the actual forceload macro call -- so it stays 0
# whether forceload_here failed to load on this game version, aborted on a
# macro expansion, or the forceload command itself errored.
# Passed-entity cull -- the release band below (forceload remove,
# ~-336..-256 x ±64) is about to unload: remove every non-player entity in
# it first, so passed mobs, drops and stands are neither saved into the
# unloaded chunks nor left for a revisit to reload (the safe salvage of the
# retired trail wiper -- entities only, no block work). The band is fully
# behind the ride by construction: the pace cart (the ride's rearmost
# piece, plug aboard) rides at ~-224, the rider at -.RIDER_BEHIND, and the
# head markers sit at the head itself -- so type=!player is the only
# exclusion needed.
execute positioned ~-336 -64 ~-64 run kill @e[type=!player,dx=80,dy=384,dz=128]
# Second pass, items only: mobs killed by the line above drop their loot
# (doMobLoot is on; only doTileDrops is off), and those item entities spawn
# AFTER the first kill's selector was evaluated -- without this pass they
# were saved into the very chunks the release below unloads, the exact
# thing the cull exists to prevent. (No XP pass needed: command kills give
# no player credit, so no orbs spawn. Bedrock's cull has no such gap -- its
# entity.remove() despawns without drops.)
execute positioned ~-336 -64 ~-64 run kill @e[type=item,dx=80,dy=384,dz=128]
scoreboard players set .flok ir 0
function infinite_rail:forceload_here
# One-shot loud diagnostic instead of the silent chunk-starved death spiral
# build_loop's head gate protects against: if forceloading is broken, SAY SO.
# Re-arms after a success, so a transient failure can warn again later.
execute if score .flok ir matches 0 unless score .flwarn ir matches 1 run tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Warning: chunk force-loading is failing, so terrain cannot be prepared ahead of the ride (track building will pause at the loaded edge). Please report this with your exact Minecraft version.","color":"yellow"}]
execute if score .flok ir matches 0 run scoreboard players set .flwarn ir 1
execute if score .flok ir matches 1 run scoreboard players set .flwarn ir 0
# Keep world spawn and respawn points moving with the ride so nothing is
# anchored to the origin.
setworldspawn ~ ~1 ~
spawnpoint @a ~ ~1 ~
scoreboard players add .nextLoad ir 16
