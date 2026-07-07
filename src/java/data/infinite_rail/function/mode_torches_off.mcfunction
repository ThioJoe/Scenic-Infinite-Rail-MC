# Mode toggle:  /function infinite_rail:mode_torches_off
# Stops planting torches along new track entirely (both the always-on mode
# and the default night-only auto mode -- .TORCHMODE is a tri-state 0/1/2).
# Torches already placed stay where they are (they unload behind the ride
# with their chunks like everything else).
scoreboard players set .TORCHMODE ir 0
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Torch mode OFF - new track stays unlit.","color":"gray"}]
