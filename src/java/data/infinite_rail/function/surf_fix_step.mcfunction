# (recursive; positioned .scy below a side cell's rail level, after the
# clear) Walks DOWN past air and spared plants to the newly exposed top
# block, then restores it: exposed DIRT becomes the remembered surface
# material (.sfc, see surf_class -- class 5's snowy ground turns to grass
# like the grass a snow layer usually sits on), and snow cover (class 5)
# additionally lays a fresh snow layer on the new top whatever it is.
# Anything else (stone, sand, ...) already looks natural and is left alone.
# Bounded to 8 below the rail: deeper means the clear exposed nothing here
# (the stack hung over a hole -- the ground down there was never covered).
scoreboard players set .sgo ir 0
execute if block ~ ~ ~ minecraft:air run scoreboard players set .sgo ir 1
execute if block ~ ~ ~ minecraft:cave_air run scoreboard players set .sgo ir 1
execute if block ~ ~ ~ #infinite_rail:keep run scoreboard players set .sgo ir 1
execute if score .sgo ir matches 0 if score .sfc ir matches 1 if block ~ ~ ~ minecraft:dirt run setblock ~ ~ ~ minecraft:grass_block
execute if score .sgo ir matches 0 if score .sfc ir matches 2 if block ~ ~ ~ minecraft:dirt run setblock ~ ~ ~ minecraft:podzol
execute if score .sgo ir matches 0 if score .sfc ir matches 3 if block ~ ~ ~ minecraft:dirt run setblock ~ ~ ~ minecraft:mycelium
execute if score .sgo ir matches 0 if score .sfc ir matches 4 if block ~ ~ ~ minecraft:dirt run setblock ~ ~ ~ minecraft:moss_block
execute if score .sgo ir matches 0 if score .sfc ir matches 5 if block ~ ~ ~ minecraft:dirt run setblock ~ ~ ~ minecraft:grass_block
execute if score .sgo ir matches 0 if score .sfc ir matches 5 if block ~ ~1 ~ minecraft:air run setblock ~ ~1 ~ minecraft:snow
scoreboard players add .scy ir 1
execute if score .sgo ir matches 1 if score .scy ir matches ..8 positioned ~ ~-1 ~ run function infinite_rail:surf_fix_step
