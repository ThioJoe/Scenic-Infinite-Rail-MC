# Try to plant ONE torch at this X/Z (runs positioned at a side spot chosen
# by place_torch): snap to the terrain surface, then attempt the placement on
# whatever ground is there. Only genuinely hopeless spots are skipped now --
# ground that is water, lava or a lily pad (a torch over liquid would float
# then pop). Everything else gets its attempt, so frozen and snowy biomes are
# lit too: ice (all kinds) holds a torch fine, and a snow LAYER occupying the
# target cell is REPLACED by the torch (line 1 -- exactly what placing one by
# hand on snowy ground does; without it, setblock's `keep` no-ops on every
# snow-covered block and whole snowfields went torchless). Elsewhere `keep`
# only fills air, so any other occupied cell stays a silent no-op.
# motion_blocking_no_leaves puts forest torches on the ground UNDER the
# canopy, not on top of it -- and means the ground below is never leaves.
# (doTileDrops is off, so even a torch popped by a later update -- e.g. a
# torch-melted ice block, or a rare unsupported spot -- drops nothing.)
execute positioned over motion_blocking_no_leaves unless block ~ ~-1 ~ minecraft:water unless block ~ ~-1 ~ minecraft:lava unless block ~ ~-1 ~ minecraft:lily_pad if block ~ ~ ~ minecraft:snow run setblock ~ ~ ~ minecraft:torch
execute positioned over motion_blocking_no_leaves unless block ~ ~-1 ~ minecraft:water unless block ~ ~-1 ~ minecraft:lava unless block ~ ~-1 ~ minecraft:lily_pad run setblock ~ ~ ~ minecraft:torch keep
