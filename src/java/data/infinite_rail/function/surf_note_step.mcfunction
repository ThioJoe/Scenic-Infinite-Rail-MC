# (recursive; positioned at a side cell .scy above the rail) Walks the
# about-to-be-cleared span bottom-to-top hunting its bottommost air cell.
# The first air found ends the walk (.sdone 1): the block just below it is
# the stack's original surface, handed to surf_class. Air at the very
# bottom (.scy 0) means the ground below the span is already exposed today
# -- clearing uncovers nothing new, so nothing is classified (.sfc stays
# 0 = leave alone).
scoreboard players set .sgo ir 0
execute if block ~ ~ ~ minecraft:air run scoreboard players set .sgo ir 1
execute if block ~ ~ ~ minecraft:cave_air run scoreboard players set .sgo ir 1
execute if score .sgo ir matches 1 run scoreboard players set .sdone ir 1
execute if score .sgo ir matches 1 unless score .scy ir matches 0 positioned ~ ~-1 ~ run function infinite_rail:surf_class
scoreboard players add .scy ir 1
execute if score .sdone ir matches 0 if score .scy ir <= .ch ir positioned ~ ~1 ~ run function infinite_rail:surf_note_step
