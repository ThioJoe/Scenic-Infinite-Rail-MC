# Ride speed - (one block/s slower). Reached from the "Speed -" hotbar item
# (via speed_click), from the Settings book's [-] link (via menu_tick), or
# by hand:  /function infinite_rail:speed_dec
scoreboard players set .spdir ir -1
function infinite_rail:speed_step
function infinite_rail:speed_apply
