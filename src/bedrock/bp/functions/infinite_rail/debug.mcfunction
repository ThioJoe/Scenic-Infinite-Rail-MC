# Convenience switch:  /function infinite_rail/debug
# Turns on the ride's debug chat output (speed system, corridor generation
# status) AND re-enables command feedback -- setup_world silences it for a
# clean ride, which also hides the results of hand-run /scoreboard tweaks.
scoreboard players set .DEBUGMODE ir 1
gamerule sendcommandfeedback true
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Debug mode ON, command feedback enabled. Run §b/function infinite_rail/debug_off§7 to silence."}]}
