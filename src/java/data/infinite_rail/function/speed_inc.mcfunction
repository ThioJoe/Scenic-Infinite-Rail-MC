# Ride speed + (one notch faster -- .SPEEDSTEP blocks/s, from the shared
# consts.mcfunction). Reached from the "Speed +" hotbar item (via
# speed_click) or by hand:  /function infinite_rail:speed_inc
# The arithmetic (clamp 1..64, default detection) is the shared speed_step;
# speed_apply pushes the result into the minecart max-speed gamerule and
# reports the new value.
scoreboard players operation .spdir ir = .SPEEDSTEP ir
# A single-notch click: walk the selectable-speed grid (fine below 8) -- see speed_step.
scoreboard players set .spstep ir 1
function infinite_rail:speed_step
function infinite_rail:speed_apply
