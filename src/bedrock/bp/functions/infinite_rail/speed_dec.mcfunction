# Ride speed - (one notch slower -- .SPEEDSTEP blocks/s, from the shared
# consts.mcfunction). Reached from the "Speed -" hotbar item (scripts/main.js
# runs this on itemUse) or by hand:  /function infinite_rail/speed_dec
scoreboard players set .spdir ir 0
scoreboard players operation .spdir ir -= .SPEEDSTEP ir
# A single-notch click: walk the selectable-speed grid (fine below 8) -- see speed_step.
scoreboard players set .spstep ir 1
function infinite_rail/speed_step
function infinite_rail/speed_msg
