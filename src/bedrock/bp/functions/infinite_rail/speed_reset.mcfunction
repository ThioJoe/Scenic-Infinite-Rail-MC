# Reset the ride speed back to the config default (.MAXSPEED). The Settings
# form's slider covers this too (its label shows the default); this function
# exists for chat parity with Java:  /function infinite_rail/speed_reset
scoreboard players set .spdir ir 0
function infinite_rail/speed_step
function infinite_rail/speed_msg
