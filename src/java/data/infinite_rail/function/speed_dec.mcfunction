# Ride speed - (one notch slower -- .SPEEDSTEP blocks/s, from the shared
# consts.mcfunction). Reached from the "Speed -" hotbar item (via
# speed_click) or by hand:  /function infinite_rail:speed_dec
scoreboard players set .spdir ir 0
scoreboard players operation .spdir ir -= .SPEEDSTEP ir
function infinite_rail:speed_step
function infinite_rail:speed_apply
