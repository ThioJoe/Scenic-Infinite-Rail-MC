# Try to plant ONE torch at this X/Z (runs positioned at a side spot chosen
# by place_torch): snap to the terrain surface, then attempt the placement on
# whatever ground is there. Only genuinely hopeless spots are skipped now --
# ground that is lava or a lily pad (a torch over liquid would float then pop).
# Water is handled specially below (a sea pickle on the bed) instead of being
# skipped. Everything else gets its torch attempt, so frozen and snowy biomes
# are lit too: ice (all kinds) holds a torch fine, and a snow LAYER occupying
# the target cell is REPLACED by the torch (line 3 -- exactly what placing one
# by hand on snowy ground does; without it, setblock's `keep` no-ops on every
# snow-covered block and whole snowfields went torchless). Elsewhere `keep`
# only fills air, so any other occupied cell stays a silent no-op.
# motion_blocking_no_leaves puts forest torches on the ground UNDER the
# canopy, not on top of it -- and means the ground below is never leaves.
# (doTileDrops is off, so even a torch popped by a later update -- e.g. a
# torch-melted ice block, or a rare unsupported spot -- drops nothing.)
#
# WATER: a torch can't stand on water, so torch mode plants a sea pickle on the
# bed instead (config .SEAPICKLE 1..4 = how many pickles = brightness; 0 = the
# old skip-water behavior, no GUI option). ocean_floor is the same terrain
# heightmap idea as motion_blocking_no_leaves but it ALSO excludes fluids, so
# re-snapping to it drops onto the true sea/lake/river bed; the pickle goes in
# the bottom water cell, waterlogged so it glows. Water is checked twice: at
# the motion_blocking_no_leaves surface (would the torch have floated?) and at
# the bed cell (is it really submerged?). .pickle n carries the count to the
# macro (block states can't come from scoreboards).
execute store result storage infinite_rail:pickle n int 1 run scoreboard players get .SEAPICKLE cfg_ride
execute if score .SEAPICKLE cfg_ride matches 1..4 positioned over motion_blocking_no_leaves if block ~ ~-1 ~ minecraft:water positioned over ocean_floor if block ~ ~ ~ minecraft:water run function infinite_rail:pickle_place with storage infinite_rail:pickle
execute positioned over motion_blocking_no_leaves unless block ~ ~-1 ~ minecraft:water unless block ~ ~-1 ~ minecraft:lava unless block ~ ~-1 ~ minecraft:lily_pad if block ~ ~ ~ minecraft:snow run setblock ~ ~ ~ minecraft:torch
execute positioned over motion_blocking_no_leaves unless block ~ ~-1 ~ minecraft:water unless block ~ ~-1 ~ minecraft:lava unless block ~ ~-1 ~ minecraft:lily_pad run setblock ~ ~ ~ minecraft:torch keep
