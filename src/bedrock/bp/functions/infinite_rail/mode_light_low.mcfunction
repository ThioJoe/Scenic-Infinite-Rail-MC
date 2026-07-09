# Mode toggle:  /function infinite_rail/mode_light_low
# Track light: low (light level 8) -- a dim glow above new track.
scoreboard players set .LIGHTMODE ir 8
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light LOW - new track gets a dim glow."}]}
