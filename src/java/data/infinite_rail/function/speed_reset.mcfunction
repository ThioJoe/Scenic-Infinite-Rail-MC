# Reset the ride speed back to the config default (.DEFAULTSPEED). Reached
# from the Speed Reset hotbar item (via speed_click) or by hand:
#   /function infinite_rail:speed_reset
# The message it prints shows the resulting number with "(default)".
# Direction-aware while reversing (the shared speed_step): backwards faster
# than the default resets to the REVERSE default (-.DEFAULTSPEED); anywhere
# between that and 0 inclusive resets forward to the plain default.
scoreboard players set .spdir ir 0
# A reset is an absolute set, not a grid walk: keep speed_step off the grid.
scoreboard players set .spstep ir 0
function infinite_rail:speed_step
function infinite_rail:speed_apply
