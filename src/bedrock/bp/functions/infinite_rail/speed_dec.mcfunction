# Ride speed - (one block/s slower). Reached from the "Speed -" hotbar item
# (scripts/main.js runs this on itemUse), from the Settings form's speed
# slider, or by hand:  /function infinite_rail/speed_dec
scoreboard players set .spdir ir -1
function infinite_rail/speed_step
function infinite_rail/speed_msg
