# Mode toggle:  /function infinite_rail/mode_night_on
# Endless night: freezes the daylight cycle and sets the time to midnight,
# so the moon hangs still at its highest. World state, not ride state -- it
# sticks across /reload and rejoins and stacks with the other modes (combine
# with mode_torches_on for a lantern-lit night ride).
scoreboard players set .NIGHTMODE ir 1
gamerule dodaylightcycle false
time set midnight
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Night mode ON - frozen at midnight. §b/function infinite_rail/mode_night_off§7 restores daytime."}]}
