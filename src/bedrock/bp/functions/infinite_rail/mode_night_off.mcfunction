# Mode toggle:  /function infinite_rail/mode_night_off
# Back to default time: sets the clock to morning and resumes the daylight
# cycle.
scoreboard players set .NIGHTMODE ir 0
gamerule dodaylightcycle true
time set day
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Night mode OFF - daylight restored."}]}
