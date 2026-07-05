# Torch mode (#TORCHMODE -- see mode_torches_on): sprinkle torches on the
# terrain around the line as it is built. Runs positioned at the head, once
# per column, from advance. Three rolls:
#   1. does this column get a torch at all? (#TORCHODDS percent chance)
#   2. how far out does it land? (uniform 2..#TORCHRANGE blocks -- the floor
#      of 2 keeps clear of the 3-wide carve; clamped to 48, the ceiling the
#      widened forceload corridor supports -- see forceload_here)
#   3. which side of the line? (the storage write's +-1 scale is the sign)
# /random only rolls literal ranges and positions can't come from
# scoreboards, so the distance is scaled from a fixed 0..99 roll and the
# signed result is handed to the torch_at macro as a literal Z offset.
execute store result score #tr ir run random value 1..100
execute if score #tr ir > #TORCHODDS ir run return 0
# Distance = 2 + roll * (range - 1) / 100, with roll = 0..99.
scoreboard players operation #td ir = #TORCHRANGE ir
execute if score #td ir matches ..2 run scoreboard players set #td ir 2
execute if score #td ir matches 49.. run scoreboard players set #td ir 48
scoreboard players remove #td ir 1
execute store result score #tr ir run random value 0..99
scoreboard players operation #td ir *= #tr ir
scoreboard players operation #td ir /= #C100 ir
scoreboard players add #td ir 2
# Side: write the macro arg with scale +1 or -1 to pick south or north.
execute store result score #tr ir run random value 0..1
execute if score #tr ir matches 0 store result storage infinite_rail:torch dz int 1 run scoreboard players get #td ir
execute if score #tr ir matches 1 store result storage infinite_rail:torch dz int -1 run scoreboard players get #td ir
function infinite_rail:torch_at with storage infinite_rail:torch
