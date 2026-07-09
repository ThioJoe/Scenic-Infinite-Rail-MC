# Mode toggle:  /function infinite_rail/mode_light_on
# Track light: bright (light level 11 -- the default). scripts/main.js reads
# .LIGHTMODE per column (lightLevel()) and places the matching
# light_block_<n>; already-built track keeps whatever it was built with.
scoreboard players set .LIGHTMODE ir 11
tellraw @a {"rawtext":[{"text":"§6[Scenic Rail]§r §7Track light ON - new track gets the bright line (the default)."}]}
