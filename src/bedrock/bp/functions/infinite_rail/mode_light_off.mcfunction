# Mode toggle:  /function infinite_rail/mode_light_off
# Track light: off -- no light block above new track (dark tunnels and
# nights; hostile mobs can spawn in the unlit tunnels left behind).
scoreboard players set .LIGHTMODE ir 0
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light OFF - new track is built dark."}]}
