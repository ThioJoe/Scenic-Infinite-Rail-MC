# Ride speed + (one block/s faster). Reached from the "Speed +" hotbar item
# (scripts/main.js runs this on itemUse), from the Settings form's speed
# slider (fed through as a delta), or by hand:
#   /function infinite_rail/speed_inc
# The arithmetic (clamp 1..64, default detection) is the shared speed_step;
# the APPLY is native -- the script reads .speed as the virtual pace target
# every tick -- so only the message remains (speed_msg).
scoreboard players set .spdir ir 1
function infinite_rail/speed_step
function infinite_rail/speed_msg
