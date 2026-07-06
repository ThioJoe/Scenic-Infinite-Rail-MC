# Ride speed + (one block/s faster). Reached from the "Speed +" hotbar item
# (via speed_click), from the Settings book's [+] link (via menu_tick), or
# by hand:  /function infinite_rail:speed_inc
# The arithmetic (clamp 1..64, default detection) is the shared speed_step;
# speed_apply pushes the result into the minecart max-speed gamerule and
# reports the new value.
scoreboard players set .spdir ir 1
function infinite_rail:speed_step
function infinite_rail:speed_apply
