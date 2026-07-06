# Time mode:  /function infinite_rail/mode_day_on
# DAY ONLY: freezes the daylight cycle and sets the time to noon, so the sun
# hangs still at its highest -- endless daylight for the scenery. One of the
# tri-state time options (.NIGHTMODE: 0 = default cycle, 1 = night only,
# 2 = day only). World state like the other modes.
scoreboard players set .NIGHTMODE ir 2
gamerule dodaylightcycle false
time set noon
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Time: day only - frozen at noon."}]}
