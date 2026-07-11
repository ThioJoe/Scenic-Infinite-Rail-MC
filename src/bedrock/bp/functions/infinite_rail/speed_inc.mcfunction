# Ride speed + (one notch faster -- .SPEEDSTEP blocks/s, from the shared
# consts.mcfunction). Reached from the "Speed +" hotbar item (scripts/main.js
# runs this on itemUse) or by hand:  /function infinite_rail/speed_inc
# The arithmetic (clamp 1..64, default detection) is the shared speed_step;
# the APPLY is native -- the script reads .speed as the virtual pace target
# every tick -- so only the message remains (speed_msg).
scoreboard players operation .spdir ir = .SPEEDSTEP ir
# A single-notch click: walk the selectable-speed grid (fine below 8) -- see speed_step.
scoreboard players set .spstep ir 1
function infinite_rail/speed_step
function infinite_rail/speed_msg
