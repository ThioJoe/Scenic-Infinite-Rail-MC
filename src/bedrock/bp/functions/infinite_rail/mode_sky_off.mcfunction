# Mode toggle:  /function infinite_rail/mode_sky_off
# Ends the high-altitude cruise: the shared decide goes back to the terrain-
# following target, so the rail descends in one long 45-degree glide onto the
# landscape. scripts/main.js sees the toggle-off transition and hands the
# speed back to the ocean system with fresh counters.
scoreboard players set .SKYMODE ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Sky mode OFF - gliding back down to the terrain."}]}
