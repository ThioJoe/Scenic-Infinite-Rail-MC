# Time mode:  /function infinite_rail/mode_night_on
# NIGHT ONLY: freezes the daylight cycle and sets the time to midnight, so
# the moon hangs still at its highest. One of the tri-state time options
# (.NIGHTMODE: 0 = default cycle, 1 = night only, 2 = day only -- see
# mode_day_on / mode_night_off). World state, not ride state -- it sticks
# across /reload and rejoins and stacks with the other modes (combine with
# mode_torches_on for a lantern-lit night ride).
scoreboard players set .NIGHTMODE ir 1
gamerule dodaylightcycle false
time set midnight
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: night only - frozen at midnight."}]}
