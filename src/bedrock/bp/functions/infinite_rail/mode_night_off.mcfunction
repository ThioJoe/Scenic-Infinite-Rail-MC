# Time mode:  /function infinite_rail/mode_night_off
# Back to DEFAULT time: sets the clock to morning and resumes the normal
# day/night cycle. Ends either frozen time option (night only / day only --
# .NIGHTMODE back to 0); mode_day_off is an alias for this.
scoreboard players set .NIGHTMODE ir 0
gamerule dodaylightcycle true
time set day
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Time: default - normal day/night cycle restored."}]}
