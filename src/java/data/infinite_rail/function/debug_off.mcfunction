# Convenience switch:  /function infinite_rail:debug_off
# Silences the ride's debug chat output again (the quiet default).
scoreboard players set .DEBUGMODE ir 0
tellraw @a [{"text":"[Scenic Rail] ","color":"gold"},{"text":"Debug mode OFF.","color":"gray"}]
