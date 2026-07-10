# Reset the ride speed back to the config default (.DEFAULTSPEED). Reached from
# the Ride Settings book's [Reset] link (via menu_tick) or by hand:
#   /function infinite_rail:speed_reset
# The message it prints shows the resulting number with "(default)".
scoreboard players set .spdir ir 0
function infinite_rail:speed_step
function infinite_rail:speed_apply
