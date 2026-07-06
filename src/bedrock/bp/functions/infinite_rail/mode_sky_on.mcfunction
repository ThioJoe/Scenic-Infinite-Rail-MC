# Mode toggle:  /function infinite_rail/mode_sky_on
# High-altitude cruise: the SHARED decide steers the rail to the fixed .SKYY
# altitude (default 200 -- just above the clouds) in one long 45-degree
# climb, then holds it dead level above the world. scripts/main.js watches
# .SKYMODE every tick: it drives the pace at .SKYSPEED and pauses the ocean
# speed system while the mode owns the speed -- so this file only needs to
# flip the score.
scoreboard players set .SKYMODE ir 1
tellraw @a {"rawtext":[{"text":"§6[Infinite Rail]§r §7Sky mode ON - climbing to cruising altitude."}]}
