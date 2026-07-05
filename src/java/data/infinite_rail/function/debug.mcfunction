# Convenience switch:  /function infinite_rail:debug
# Turns on the ride's debug chat output (the minecart-speed / ocean system).
# Command feedback for hand-run /scoreboard tweaks is a separate gamerule
# (sendCommandFeedback before 25w44a, send_command_feedback after) -- left
# untouched here because its name differs across the supported versions;
# toggle it manually if you want /scoreboard results echoed.
scoreboard players set .DEBUGMODE ir 1
tellraw @a [{"text":"[Infinite Rail] ","color":"gold"},{"text":"Debug mode ON. Run ","color":"gray"},{"text":"/function infinite_rail:debug_off","color":"aqua"},{"text":" to silence.","color":"gray"}]
