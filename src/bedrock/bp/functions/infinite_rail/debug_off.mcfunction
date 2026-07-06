# Convenience switch:  /function infinite_rail/debug_off
# Silences the debug output and command feedback again (the quiet defaults).
scoreboard players set .DEBUGMODE ir 0
gamerule sendcommandfeedback false
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Debug mode OFF, command feedback silenced."}]}
