# Rolling chunk management, run every 16 blocks of head travel, positioned
# at the head marker.

# Force-generate terrain .GENAHEAD blocks ahead of the head (so the heightmap
# scanner always has real data) and release chunks far behind; there is no
# going back. forceload needs literal coordinates, so the distances (length,
# and a torch-mode-aware width) are computed into storage and handed to a
# macro -- see forceload_here.
# .flok is the success flag: preset to 0 here, set to 1 by forceload_here's
# store-success around the actual forceload macro call -- so it stays 0
# whether forceload_here failed to load on this game version, aborted on a
# macro expansion, or the forceload command itself errored.
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
