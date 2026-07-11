# (recursive; positioned at a candidate surface block) Classifies the block
# here into .sfc -- the surface-restoration class surf_fix paints the newly
# exposed ground back to:
#   1 grass block   2 podzol   3 mycelium   4 moss block
#   5 snow -- a snow layer or a snow block, checked FIRST: a layer sits ON
#     the surface like a plant, so the plant skip below would walk past it
#   0 anything else = leave the exposed ground alone (stone under stone,
#     sand under sand... already look natural)
# A plant standing on the surface isn't the surface: up to 3 kept-vegetation
# cells (#infinite_rail:keep -- a flower, tall grass, a berry bush) are
# stepped down through before giving up.
# The Bedrock twin is main.js noteSurface's SURFACE_CLASSES map -- keep the
# two lists in step (mind the inverted snow ids over there).
execute if block ~ ~ ~ minecraft:snow run scoreboard players set .sfc ir 5
execute if block ~ ~ ~ minecraft:snow_block run scoreboard players set .sfc ir 5
execute if block ~ ~ ~ minecraft:grass_block run scoreboard players set .sfc ir 1
execute if block ~ ~ ~ minecraft:podzol run scoreboard players set .sfc ir 2
execute if block ~ ~ ~ minecraft:mycelium run scoreboard players set .sfc ir 3
execute if block ~ ~ ~ minecraft:moss_block run scoreboard players set .sfc ir 4
scoreboard players add .sks ir 1
execute if score .sfc ir matches 0 if score .sks ir matches ..3 if block ~ ~ ~ #infinite_rail:keep positioned ~ ~-1 ~ run function infinite_rail:surf_class
