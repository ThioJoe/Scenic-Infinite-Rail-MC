# Reset the ride speed back to the config default (.DEFAULTSPEED). The Settings
# form's slider covers this too (its label shows the default); this function
# exists for chat parity with Java:  /function infinite_rail/speed_reset
scoreboard players set .spdir ir 0
# A reset is an absolute set, not a grid walk: keep speed_step off the grid.
scoreboard players set .spstep ir 0
function infinite_rail/speed_step
function infinite_rail/speed_msg
