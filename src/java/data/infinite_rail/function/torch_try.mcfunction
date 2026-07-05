# Try to plant ONE torch at this X/Z (runs positioned at a side spot chosen
# by place_torch): snap to the terrain surface, then place only where a torch
# can actually stand. A missing torch is invisible; a floating or popped one
# is not -- so every doubtful spot is skipped:
#   - setblock's `keep` mode only fills AIR (plants/snow layers in the target
#     cell just make the spot a no-op),
#   - the ground below must not be water or lava (the heightmap counts liquid
#     surfaces as terrain, and a torch over water would float then pop),
#   - nor ice (torches can't attach to it), a snow layer, or a lily pad.
# motion_blocking_no_leaves puts forest torches on the ground UNDER the
# canopy, not on top of it -- and means the ground below is never leaves.
# (doTileDrops is off, so even a torch popped by a later update drops nothing.)
execute positioned over motion_blocking_no_leaves unless block ~ ~-1 ~ minecraft:water unless block ~ ~-1 ~ minecraft:lava unless block ~ ~-1 ~ minecraft:ice unless block ~ ~-1 ~ minecraft:snow unless block ~ ~-1 ~ minecraft:lily_pad run setblock ~ ~ ~ minecraft:torch keep
