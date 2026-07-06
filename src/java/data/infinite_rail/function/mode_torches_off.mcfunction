# Mode toggle:  /function infinite_rail:mode_torches_off
# Stops planting torches along new track. Torches already placed stay where
# they are (they unload behind the ride with their chunks like everything
# else).
scoreboard players set .TORCHMODE ir 0
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch mode OFF - new track stays unlit.","color":"gray"}]
