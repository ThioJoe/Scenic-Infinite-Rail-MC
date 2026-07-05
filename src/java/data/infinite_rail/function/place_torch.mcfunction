# Torch mode (#TORCHMODE -- see mode_torches_on): sprinkle torches on the
# terrain around the line as it is built. Runs positioned at the head, once
# per column, from advance. Two rolls:
#   1. does this column get a torch at all? (#TORCHODDS percent chance)
#   2. which of ten preset side spots does it land on? (2-8 blocks left or
#      right of the centerline -- always clear of the 3-wide carve)
# Coordinates can't come from scoreboards without macro plumbing, so the ten
# offsets are preset lines; the odds knob stays a plain score.
execute store result score #tr ir run random value 1..100
execute if score #tr ir > #TORCHODDS ir run return 0
execute store result score #tr ir run random value 1..10
execute if score #tr ir matches 1 positioned ~ ~ ~-8 run function infinite_rail:torch_try
execute if score #tr ir matches 2 positioned ~ ~ ~-6 run function infinite_rail:torch_try
execute if score #tr ir matches 3 positioned ~ ~ ~-5 run function infinite_rail:torch_try
execute if score #tr ir matches 4 positioned ~ ~ ~-3 run function infinite_rail:torch_try
execute if score #tr ir matches 5 positioned ~ ~ ~-2 run function infinite_rail:torch_try
execute if score #tr ir matches 6 positioned ~ ~ ~2 run function infinite_rail:torch_try
execute if score #tr ir matches 7 positioned ~ ~ ~3 run function infinite_rail:torch_try
execute if score #tr ir matches 8 positioned ~ ~ ~5 run function infinite_rail:torch_try
execute if score #tr ir matches 9 positioned ~ ~ ~6 run function infinite_rail:torch_try
execute if score #tr ir matches 10 positioned ~ ~ ~8 run function infinite_rail:torch_try
